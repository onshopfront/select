import React from "react";
import {
    OptionType,
    SelectChangeType,
    SelectCreatableType,
    SelectGroupType,
    SelectOptionType,
    SelectValueType
} from "./Select";
import { IconOption } from "./SelectIcon";

interface Props {
    option: OptionType;
    address: Array<number>;
    layer: number;
    onChange: SelectChangeType;
    highlighted: boolean;
    onHighlight: (index: Array<number>) => void;
    selected: SelectValueType;
    isMulti: boolean;
    renderLabel?: (option: OptionType, selected: boolean, group: boolean) => React.ReactNode;
    createOptionMessage: () => React.ReactNode;
    lastSelected: boolean;
    iconRenderer: React.ComponentType<{ icon: IconOption }>;
    style: React.CSSProperties;
}

interface State {
    isSelected: boolean;
}

export function isGroupValue(value: OptionType): value is SelectGroupType {
    if ("options" in value) {
        return Array.isArray(value.options);
    }

    return false;
}

export function isCreatableValue(value: OptionType): value is SelectCreatableType {
    return "creatable" in value;
}

export function isSelectValue(value: OptionType): value is SelectOptionType {
    return !isGroupValue(value) && !isCreatableValue(value);
}

export default class SelectOption extends React.Component<Props, State> {
    public itemRef: React.RefObject<HTMLDivElement> = React.createRef();

    public state = {
        isSelected: false,
    };

    public componentDidMount(): void {
        this.checkSelected();
    }

    public componentDidUpdate(prevProps: Readonly<Props>): void {
        if (this.props.selected !== prevProps.selected || this.props.option !== prevProps.option) {
            this.checkSelected();
        }
    }

    public renderGroup = (): React.ReactNode => {
        if (!isGroupValue(this.props.option)) {
            return null;
        }

        let { label } = this.props.option;
        if (typeof this.props.renderLabel === "function") {
            label = this.props.renderLabel(this.props.option, false, true);
        }

        return (
            <div
                ref={this.itemRef}
                className="select-group"
                style={this.props.style}
            >
                <div
                    className="select-group-label"
                    style={{
                        paddingLeft: `${0.5 * this.props.layer}rem`,
                    }}
                >
                    {label}
                </div>
            </div>
        );
    };

    public checkSelected = (): void => {
        let isSelected = false;

        if (this.props.option) {
            if (!Array.isArray((this.props.option as SelectGroupType).options)) {
                if (this.props.selected) {
                    const { value } = this.props.option as SelectOptionType;

                    if (Array.isArray(this.props.selected)) {
                        isSelected = !!this.props.selected.find(option => (option as SelectOptionType).value === value);
                    } else {
                        isSelected = (this.props.selected as SelectOptionType).value === value;
                    }
                }
            }
        }

        this.setState({
            isSelected,
        });
    };

    public onClick = (): void => {
        if (isGroupValue(this.props.option)) {
            return;
        }

        this.props.onChange(this.props.option);
    };

    public onHover = (): void => {
        this.props.onHighlight(this.props.address);
    };

    public renderOption = (): React.ReactNode => {
        if (!isSelectValue(this.props.option)) {
            return null;
        }

        const classes = ["select-option"];

        if (this.props.highlighted) {
            classes.push("highlighted");
        }

        if (this.state.isSelected) {
            classes.push("selected");
        }

        if (this.props.lastSelected) {
            classes.push("last-selected");
        }

        let multi = null;
        if (this.props.isMulti) {
            const IconElement = this.props.iconRenderer;

            multi = (
                <span className="select-multi-indicator">
                    <IconElement
                        icon={(this.state.isSelected ? "checkbox-checked" : "checkbox")}
                    />
                </span>
            );
        }

        let { label } = this.props.option;
        if (typeof this.props.renderLabel === "function") {
            label = this.props.renderLabel(this.props.option, this.state.isSelected, false);
        } else {
            label = <React.Fragment>{multi} {label}</React.Fragment>;
        }

        return (
            <div
                ref={this.itemRef}
                className={classes.join(" ")}
                style={{
                    ...this.props.style,
                    paddingLeft: `${0.5 * this.props.layer}rem`,
                }}
                onClick={this.onClick}
                onMouseEnter={this.onHover}
            >
                {label}
            </div>
        );
    };

    public renderCreatable = (): React.ReactNode => {
        const classes = ["select-option", "select-creatable"];

        if (this.props.highlighted) {
            classes.push("highlighted");
        }

        return (
            <div
                ref={this.itemRef}
                className={classes.join(" ")}
                style={{
                    ...this.props.style,
                    paddingLeft: `${0.5 * this.props.layer}rem`,
                }}
                onClick={this.onClick}
                onMouseEnter={this.onHover}
            >
                {this.props.createOptionMessage()}
            </div>
        );
    };

    public render(): React.ReactNode {
        if (!this.props.option) {
            return (
                <div
                    className="select-option-empty"
                    style={this.props.style}
                />
            );
        }

        if (isCreatableValue(this.props.option)) {
            return this.renderCreatable();
        }

        if (isGroupValue(this.props.option)) {
            return this.renderGroup();
        }

        return this.renderOption();
    }
}
