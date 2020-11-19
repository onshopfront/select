import React from "react";
import {
    OptionType,
    SelectChangeType,
    SelectGroupType,
    SelectOptionsType,
    SelectValueType
} from "./Select";
import SelectOption, { isGroupValue, isSelectValue } from "./SelectOption";
import { IconOption, SelectIcon } from "./SelectIcon";
import { FixedSizeList, ListChildComponentProps } from "react-window";

type Props = {
    options: SelectOptionsType;
    noOptionsMessage: string;
    onChange: SelectChangeType;
    highlighted: Array<number>;
    onHighlight: (index: Array<number>) => void;
    isCreatable: boolean;
    createOptionMessage: () => string;
    selected: SelectValueType;
    loading: boolean;
    isMulti: boolean;
    onOpen: () => void;
    selectedLength: number;
    renderLabel?: (option: OptionType, selected: boolean, group: boolean) => React.ReactNode;
    onReposition: () => void;
    iconRenderer: React.ComponentType<{ icon: IconOption }>;
}

type FlatOptionType = Array<number>;

type State = {
    refReady: boolean;
    flattened: Array<FlatOptionType>;
}

// The maximum number of non selected flattened values before the selected values become visible
const MAX_HIDE_MULTI_VALUES = 10;

function flattenOptions(
    options: SelectOptionsType,
    index: Array<number> = [],
    results: Array<FlatOptionType> = []
): Array<FlatOptionType> {
    for (let i = 0, l = options.length; i < l; i++) {
        const option = options[i];

        // Add the item address to the results
        const address = [ ...index, i ];
        results.push(address);

        if (isGroupValue(option)) {
            // Add the groups children to the results
            flattenOptions(option.options, address, results);
        }
    }

    return results;
}

function findSelectedAddress(
    options: SelectOptionsType,
    selected: SelectValueType
): Array<number> | false {
    if (Array.isArray(selected)) {
        return false;
    }

    for (let i = 0, l = options.length; i < l; i++) {
        const option = options[i];

        if (isGroupValue(option)) {
            const childAddress = findSelectedAddress(option.options, selected);

            if (Array.isArray(childAddress)) {
                return [i, ...childAddress];
            }
        } else if (isSelectValue(option)) {
            if (option.value === selected?.value) {
                return [i];
            }
        }
    }

    return false;
}

export default class SelectMenu extends React.PureComponent<Props, State> {
    public menuRef: HTMLDivElement | null = null;

    constructor(props: Readonly<Props>) {
        super(props);

        this.state = {
            refReady : false,
            flattened: flattenOptions(props.options),
        };
    }

    public componentDidMount(): void {
        requestAnimationFrame(() => {
            this.props.onOpen();
        });
    }

    public componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>): void {
        if (prevProps.options !== this.props.options) {
            this.setState({
                flattened: flattenOptions(this.props.options),
            });
        }

        if (prevProps.highlighted !== this.props.highlighted) {
            this.scrollToAddress(this.props.highlighted);
        }

        if (!prevState.refReady && this.state.refReady) {
            requestAnimationFrame(() => {
                if (this.props.selected) {
                    const selected = findSelectedAddress(this.props.options, this.props.selected);

                    if (Array.isArray(selected)) {
                        this.scrollToAddress(selected);
                    }
                }
            });
        }
    }

    public scrollToAddress = (address: Array<number>): void => {
        if (!this.state.refReady || !this.menuRef) {
            return;
        }

        const search = address.join("-");
        const index = this.state.flattened.findIndex(flat => flat.join("-") === search);

        if (index >= 0) {
            this.scrollToIndex(index);
        }
    };

    public scrollToIndex = (index: number): void => {
        if (!this.state.refReady || !this.menuRef) {
            return;
        }

        // Location to scroll to
        let to = index * 35;

        // Get the bonding box
        const { scrollTop, clientHeight } = this.menuRef;
        if (to > scrollTop - 34 && to < scrollTop + clientHeight) {
            return; // Already on screen
        }

        // Get the centre of the scroll box
        const middle = scrollTop + clientHeight / 2;

        if (to > middle) {
            to -= (clientHeight - 35);
        }

        if (to < 0) {
            to = 0;
        }

        this.menuRef.scrollTop = to;
    };

    public renderItem = ({ index, style }: ListChildComponentProps): React.ReactElement | null => {
        let address = this.state.flattened[index] as Array<number>;

        let lastSelected = false;
        if (this.props.isMulti) {
            const removedCount = this.state.flattened.length - this.props.selectedLength;
            if (removedCount < MAX_HIDE_MULTI_VALUES) {
                if (removedCount > 0 || !this.props.selectedLength) {
                    address = this.state.flattened[index + this.props.selectedLength] as Array<number>;
                }
            } else {
                lastSelected = index === this.props.selectedLength - 1;
            }
        }
        const addressSize = address.length;

        const highlightSize = this.props.highlighted.length;

        let highlighted = highlightSize === addressSize;
        let layer: SelectOptionsType = this.props.options;
        let option: SelectGroupType | OptionType | null = null;

        for (let i = 0; i < addressSize; i++) {
            const currentLayer: OptionType = layer[address[i]];

            // This will occur between option updates
            if (typeof currentLayer === "undefined") {
                option = null;
                break;
            }

            if (i < addressSize - 1) {
                if (isGroupValue(currentLayer)) {
                    option = currentLayer;
                    layer = currentLayer.options;
                } else {
                    option = { label: "Invalid Dataset", value: "" };
                    highlighted = false;
                    break;
                }
            } else {
                option = currentLayer;
            }

            if (highlighted) {
                highlighted = address[i] === this.props.highlighted[i];
            }
        }

        if (option === null) {
            return null;
        }

        return (
            <SelectOption
                key={index}
                option={option}
                address={address}
                layer={addressSize}
                highlighted={highlighted}
                onChange={this.props.onChange}
                onHighlight={this.props.onHighlight}
                selected={this.props.selected}
                createOptionMessage={this.props.createOptionMessage}
                isMulti={this.props.isMulti}
                renderLabel={this.props.renderLabel}
                lastSelected={lastSelected}
                style={style}
                iconRenderer={this.props.iconRenderer}
            />
        );
    };

    public render(): React.ReactNode {
        let optionCount = this.props.options.length;
        let flattenedCount = this.state.flattened.length;

        let noOptionsWithSelected = false;
        if (this.props.isMulti) {
            const selected = this.props.selected;

            const removedCount = flattenedCount - this.props.selectedLength;
            if (removedCount < MAX_HIDE_MULTI_VALUES) {
                if (removedCount > 0 || !this.props.selectedLength) {
                    flattenedCount = removedCount;
                } else {
                    noOptionsWithSelected = true;
                }

                optionCount -= this.props.selectedLength;
            } else if (Array.isArray(selected)) {
                optionCount -= selected.length;
            }
        }

        return (
            <div
                ref={(ref): void => {
                    this.menuRef = ref;

                    if (!this.state.refReady) {
                        this.setState({
                            refReady: true,
                        });
                    }
                }}
                className="select-menu"
            >
                {(!this.props.isCreatable && !optionCount && !this.props.loading) && (
                    <div className={"select-no-results" + (noOptionsWithSelected ? " last-selected" : "")}>
                        {this.props.noOptionsMessage}
                    </div>
                )}
                {this.props.loading && (
                    <div className="select-loading-results">
                        <SelectIcon icon="spinner" /> Loading...
                    </div>
                )}
                {this.state.refReady && (
                    <FixedSizeList
                        itemSize={35}
                        height={Math.min(35 * flattenedCount, 300)}
                        itemCount={flattenedCount}
                        onItemsRendered={this.props.onReposition}
                        overscanCount={20}
                        width="100%"
                        itemData={{
                            highlighted: this.props.highlighted,
                        }}
                    >
                        {this.renderItem}
                    </FixedSizeList>
                )}
            </div>
        );
    }
}
