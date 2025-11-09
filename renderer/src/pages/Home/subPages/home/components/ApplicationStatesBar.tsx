import "mdui/components/dropdown";
import "mdui/components/chip";
import "mdui/components/menu";
import "mdui/components/card";
import type { StatesListObject } from "~/pages/Home/Home";
import { ApplicationStateLevel, type ApplicationState, type States } from "~/types/applicationState";
const LevelIcon = {
    [ApplicationStateLevel.Checked]: "checked",
    [ApplicationStateLevel.Busy]: "hourglass_top",
    [ApplicationStateLevel.Info]: "info",
    [ApplicationStateLevel.Error]: "error_outline",
    [ApplicationStateLevel.Warn]: "warning_amber",
} as const;
const LevelText = {
    [ApplicationStateLevel.Checked]: "正常",
    [ApplicationStateLevel.Busy]: "忙碌",
    [ApplicationStateLevel.Info]: "提醒",
    [ApplicationStateLevel.Warn]: "警告",
    [ApplicationStateLevel.Error]: "异常",

} as const;
interface ApplicationStateCardProps {
    stateInstance: ApplicationState
};
interface ApplicationStateBarProps {
    states: StatesListObject
}
function getStateLevel(states: StatesListObject): number {
    const keys = Reflect.ownKeys(states);
    let defaultLevel = 0;
    keys.forEach(key => {
        const state = states[key as States]!;
        if (state.level > defaultLevel) {
            defaultLevel = state.level;
        }
    });
    return defaultLevel;
}
function getCurrentStateLevelIcon(states: StatesListObject): string {
    return LevelIcon[getStateLevel(states) as keyof typeof LevelIcon]
}
function getCurrentStateLevelText(states: StatesListObject): string {
    const currentLevel = getStateLevel(states);
    return LevelText[currentLevel as keyof typeof LevelText];
}
function ApplicationStateCard({ stateInstance }: ApplicationStateCardProps) {
    return (
        <mdui-card className="flex items-center min-h-16.5 min-w-65 mt-2" clickable={stateInstance.clickable}
            onClick={stateInstance.onClick}>
            <mdui-icon name={LevelIcon[stateInstance.level]} className="ml-3" />
            <div className="flex flex-col ml-2">
                <b>{stateInstance.title}</b>
                <small>{stateInstance.content}</small>
            </div>
        </mdui-card>
    )
}
export default function ApplicationStatesBar({ states }: ApplicationStateBarProps) {
    return (
        <mdui-dropdown placement="left-start">
            <mdui-chip slot="trigger" elevated icon={getCurrentStateLevelIcon(states)} end-icon="more_vert">{getCurrentStateLevelText(states)}</mdui-chip>
            <mdui-menu>
                {
                    Reflect.ownKeys(states).map((stateId) => {
                        const state = states[stateId as States]!;
                        return (
                            <ApplicationStateCard key={stateId as string} stateInstance={state} />
                        )
                    })
                }
            </mdui-menu>
        </mdui-dropdown>
    )
}