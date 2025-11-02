import HomePage from "../subPages/home/HomePage"

export interface PageRouteProps {
    page: "home" | "transmit" | "notification" | "file" | "extension" | "setting"
}
export default function PageRoute({ page }: PageRouteProps) {
    return (
        <div className="fixed left-20 top-9.5">
            {(() => {
                switch (page) {
                    case "home":
                        return <HomePage/>
                    case "transmit":
                        return <>transmit</>
                    case "notification":
                        return <>notification</>
                    case "file":
                        return <>file</>
                    case "extension":
                        return <>extension</>
                    case "setting":
                        return <>setting</>
                    default:
                        return <>error!!!</>
                }
            })()}
        </div>
    )
}