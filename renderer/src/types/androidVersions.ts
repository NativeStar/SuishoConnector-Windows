//修改自:https://www.npmjs.com/package/android-versions
//因为Android端minSdk是29 故从Android10开始
export const AndroidVersions: { [key: number]: AndroidVersionData } = {
    29: { semver: "10", name: "Q" },
    30: { semver: "11", name: "R" },
    31: { semver: "12", name: "S" },
    32: { semver: "12L", name: "S_V2" },
    33: { semver: "13", name: "Tiramisu" },
    34: { semver: "14", name: "UpsideDownCake" },
    35: { semver: "15", name: "VanillaIceCream" },
    36: { semver: "16", name: "Baklava" },
    37: { semver: "17", name: "CinnamonBun" },
}
export type AndroidVersionData={ semver: string, name: string }