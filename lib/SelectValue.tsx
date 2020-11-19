import React from "react";
import { SelectOptionType, SelectValueType } from "./Select";
import { IconOption } from "./SelectIcon";

type Props = {
    disabled: boolean;
    isMulti: boolean;
    open: boolean;
    value: SelectValueType;
    input: string;
    onRemove: (index: number) => void;
    renderValue?: (option: SelectValueType, multi: boolean) => React.ReactNode;
    maxValues: number;
    isClearable: boolean;
    iconRenderer: React.ComponentType<{ icon: IconOption }>;
}

export function isMultiValue(value: SelectValueType): value is Array<SelectOptionType> {
    return Array.isArray(value);
}

export function isSingleValue(value: SelectValueType): value is SelectOptionType {
    return !Array.isArray(value) && !!value;
}

export default class SelectValue extends React.Component<Props> {
    public onRemove = (index: number) => {
        return (): void => {
            if (!this.props.disabled && this.props.isClearable) {
                this.props.onRemove(index);
            }
        };
    };

    public renderMulti = (): React.ReactNode => {
        if (!isMultiValue(this.props.value)) {
            return null;
        }

        const valueCount = this.props.value.length;
        const last       = this.props.maxValues - 1;
        const moreLabel  = `${valueCount - last} ${last === 0 ? "selected" : "more"}...`;
        const showMore   = valueCount > this.props.maxValues;

        const IconElement = this.props.iconRenderer;

        return (
            <div className="select-multi-values">
                {this.props.value.slice(0, (showMore ? last : this.props.maxValues)).map((value, index) => {
                    return (
                        <div
                            key={index}
                            className={"select-multi-value"}
                            onClick={this.onRemove(index)}
                            title={value.label as string}
                        >
                            <div className="select-multi-value-label">{value.label}</div>
                            {(!this.props.disabled && this.props.isClearable) && (
                                <IconElement icon="remove" />
                            )}
                        </div>
                    );
                })}
                {(showMore) && (
                    <div
                        className={"select-multi-value is-more"}
                        title={moreLabel}
                    >
                        <div className="select-multi-value-label">{moreLabel}</div>
                    </div>
                )}
            </div>
        );
    };

    public renderSingle = (): React.ReactNode => {
        if (this.props.open && this.props.input) {
            return null;
        }

        if (!isSingleValue(this.props.value)) {
            return null;
        }

        return (
            <div className="select-value">
                {this.props.value.label}
            </div>
        );
    };

    public render(): React.ReactNode {
        if (typeof this.props.renderValue === "function") {
            return this.props.renderValue(this.props.value, this.props.isMulti);
        }

        if (this.props.isMulti) {
            return this.renderMulti();
        }

        return this.renderSingle();
    }
}
