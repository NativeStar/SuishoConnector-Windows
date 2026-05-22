import "mdui/components/dropdown";
import "mdui/components/chip";
import "mdui/components/menu";
import "mdui/components/card";
import type { StateAction, StatesListObject } from "~/pages/Home/Home";
import { ApplicationStateLevel, type ApplicationState, type States } from "~/types/applicationState";
import { twMerge } from "tailwind-merge";
import ModalLayout from "~/components/ModalLayout";
import { useState } from "react";
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
    dispatch: React.ActionDispatch<StateAction>
};
interface ApplicationStateBarProps {
    states: StatesListObject
    className?: string
    dispatch: React.ActionDispatch<StateAction>
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
function ApplicationStateCard({ stateInstance, dispatch }: ApplicationStateCardProps) {
    return (
        <mdui-list-item className={stateInstance.clickable ? "" : "pointer-events-none"} end-icon={stateInstance.clickable ? "arrow_right" : ""} icon={stateInstance.icon??LevelIcon[stateInstance.level]} headline={stateInstance.title} description={stateInstance.content} onClick={() => stateInstance.onClick?.(dispatch)}>
        </mdui-list-item>
    )
}
export default function ApplicationStatesBar({ states, className, dispatch }: ApplicationStateBarProps) {
    const [stateModalShow, setStateModalShow] = useState(false);
    return (
        <>
            {stateModalShow && <ModalLayout onLayoutClick={() => setStateModalShow(false)}>
                <div className="w-10/12 h-8/12 fixed top-29 left-18 z-20 bg-[rgb(var(--mdui-color-surface-container-low))] rounded-xl flex-col" onClick={(e) => e.stopPropagation()}>
                    <mdui-list-subheader className="ml-5 h-10 font-bold">应用状态</mdui-list-subheader>
                    {
                        Reflect.ownKeys(states).length === 0 && <span className="text-[gray] absolute left-68 top-45">暂无状态 一切顺利</span>
                    }
                    {
                        Reflect.ownKeys(states).map(key => {
                            const state = states[key as States]!;
                            return (
                                <ApplicationStateCard stateInstance={state} dispatch={dispatch} key={key as string} />
                            )
                        })
                    }
                </div>
            </ModalLayout>}
            <mdui-chip onClick={() => setStateModalShow(true)} elevated icon={getCurrentStateLevelIcon(states)} end-icon="more_vert" className={twMerge("fixed", className)}>{getCurrentStateLevelText(states)}</mdui-chip>
        </>
    )
}