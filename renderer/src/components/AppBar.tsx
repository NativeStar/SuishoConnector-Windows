interface AppBarProps {
    paddingLeft:string
}
export function AppBar({paddingLeft}:AppBarProps) {
    return (
        <div style={{paddingLeft}} className="text-[#a9a9a9] title-bar mdui-theme-auto min-w-[90%] min-h-[7.7%] bg-[#fdf7fe] -mt-1.5 pt-3.5 ml-[-1%] z-2301 fixed top-0 left-0">
            Suisho Connector
        </div>
    )
}