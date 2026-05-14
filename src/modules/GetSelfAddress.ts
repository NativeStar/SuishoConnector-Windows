import { execFile } from "child_process"
import { promisify } from "util"
import type os from "os"
type NetworkInfo = {
    name: string | null;
    address: string | null;
}
const execFileAsync = promisify(execFile);
const LOG_TAG = "GetSelfAddress";
function isPrivateIPv4(ip: string) {
    if (typeof ip !== "string") return false;
    if (ip.startsWith("10.")) return true;
    if (ip.startsWith("192.168.")) return true;
    const match = /^172\.(\d{1,3})\./.exec(ip);
    if (!match) return false;
    const second = Number(match[1]);
    return second >= 16 && second <= 31;
}
function isUsableIPv4(ip: string) {
    if (typeof ip !== "string") return false;
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return false;
    if (ip === "127.0.0.1") return false;
    if (ip.startsWith("169.254.")) return false;
    return true;
}
function looksVirtual(adapter: any) {
    const text = [
        adapter.InterfaceAlias,
        adapter.InterfaceDescription,
        adapter.NetAdapterInterfaceDescription,
        adapter.Name,
        adapter.DriverDescription
    ].filter(Boolean)
        .join(" ")
        .toLowerCase();
    const keywords = [
        "virtual",
        "vmware",
        "hyper-v",
        "vethernet",
        "vbox",
        "wintun",
        "wireguard",
        "tap",
        "tun",
        "zerotier",
        "tailscale",
        "hamachi",
        "nordlynx",
        "loopback",
        "npcap",
        "container",
        "bridge"
    ];
    return keywords.some((k) => text.includes(k));
}
function normalizeArray(value: any) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}
async function getRealLanIPv4() {
    const script = `
$ErrorActionPreference = 'Stop'

$items = Get-NetIPConfiguration | ForEach-Object {
    $cfg = $_
    $adapter = Get-NetAdapter -InterfaceIndex $cfg.InterfaceIndex -ErrorAction SilentlyContinue
    $ipif = Get-NetIPInterface -InterfaceIndex $cfg.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue

    $ipv4List = @($cfg.IPv4Address | Where-Object { $_.IPAddress -and $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' })
    $gateway = $null
    if ($cfg.IPv4DefaultGateway) {
        $gateway = $cfg.IPv4DefaultGateway.NextHop
    }

    foreach ($ipv4 in $ipv4List) {
        [PSCustomObject]@{
            InterfaceIndex = $cfg.InterfaceIndex
            InterfaceAlias = $cfg.InterfaceAlias
            InterfaceDescription = $cfg.InterfaceDescription
            NetAdapterInterfaceDescription = $adapter.InterfaceDescription
            Status = $adapter.Status
            HardwareInterface = $adapter.HardwareInterface
            MacAddress = $adapter.MacAddress
            IPv4 = $ipv4.IPAddress
            PrefixLength = $ipv4.PrefixLength
            DefaultGateway = $gateway
            InterfaceMetric = $ipif.InterfaceMetric
        }
    }
}

$items | ConvertTo-Json -Depth 4
`;
    const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
        {
            windowsHide: true,
            maxBuffer: 1024 * 1024
        }
    );
    const raw = stdout.trim();
    if (!raw) return null;
    const list = normalizeArray(JSON.parse(raw)).filter((item) => isUsableIPv4(item.IPv4));
    if (list.length === 0) return null;
    const scored = list
        .map((item) => {
            let score = 0;
            if (item.Status === "Up") score += 100;
            if (item.HardwareInterface === true) score += 80;
            if (isPrivateIPv4(item.IPv4)) score += 60;
            if (item.DefaultGateway && item.DefaultGateway !== "0.0.0.0") score += 40;
            if (!looksVirtual(item)) score += 120;
            const metric = Number.isFinite(item.InterfaceMetric) ? item.InterfaceMetric : 9999;
            score -= Math.min(metric, 999);
            return { ...item, _score: score };
        })
        .sort((a, b) => b._score - a._score);
    return scored[0] || null;
}
//纯ai写的 这玩意太绕了
//尝试绕过TUN模式获取真实局域网IP
//唯一问题慢的要死
export async function getSelfAddressWithPowerShell(): Promise<NetworkInfo> {
    try {
        const result = await getRealLanIPv4();
        if (!result) {
            logger.writeWarn("Getting self address with PowerShell failed", LOG_TAG);
        }
        logger.writeDebug(`Getting self address with PowerShell success:${result}`, LOG_TAG);
        return {
            address: result.IPv4,
            name: result.InterfaceAlias
        }
    } catch (error) {
        logger.writeError(`Getting self address with PowerShell crash:${error}`, LOG_TAG);
        return {address: null,name:null}
    }
}
async function checkNetworkDriverName(name: string) {
    const VirtualNetworkDriverName=(await import("../constant/VirtualNetworkDriverName.js")).default.VirtualNetworkDriverName
    for (const virtualName of VirtualNetworkDriverName) {
        if (name.toLowerCase().includes(virtualName.toLowerCase())) {
            logger.writeInfo(`Found virtual network driver:${name}`, LOG_TAG);
            return true;
        }
    }
    return false;
}
//旧方法 可能给TUN骗 但真的很快
export async function getSelfAddressWithLegacy(interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>) {
    logger.writeDebug("Getting self address with legacy method", LOG_TAG);
    for (let devName in interfaces) {
        //跳过虚拟网卡 仅排查我碰到过的
        if (await checkNetworkDriverName(devName)) {
            logger.writeDebug(`Skipping virtual network device:${devName}`, LOG_TAG);
            continue
        }
        let iface = interfaces[devName];
        if (iface == null) return null;
        for (let i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                logger.writeDebug(`Found self address and network driver name with legacy method:${devName}:${alias.address}`, LOG_TAG);
                return {
                    address: alias.address,
                    name: devName
                }
            }
        }
    }
    logger.writeWarn("Legacy get self address failed")
    return null
}