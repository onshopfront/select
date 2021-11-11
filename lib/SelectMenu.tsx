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
import { List, ListRowProps } from "react-virtualized/dist/commonjs/List";
import { CellMeasurer, CellMeasurerCache } from "react-virtualized/dist/commonjs/CellMeasurer";

interface Props<TValue> {
    options: SelectOptionsType<TValue>;
    noOptionsMessage: string;
    onChange: SelectChangeType<TValue>;
    highlighted: Array<number>;
    onHighlight: (index: Array<number>) => void;
    isCreatable: boolean;
    createOptionMessage: () => string;
    selected: SelectValueType<TValue>;
    loading: boolean;
    isMulti: boolean;
    input: string;
    onOpen: () => void;
    selectedLength: number;
    renderLabel?: (option: OptionType<TValue>, selected: boolean, group: boolean) => React.ReactNode;
    onReposition: () => void;
    iconRenderer: React.ComponentType<{ icon: IconOption }>;
    getItemSize?: (index: number) => number;
    height?: number;
}

type FlatOptionType = Array<number>;

type State = {
    refReady: boolean;
    flattened: Array<FlatOptionType>;
}

// The maximum number of non selected flattened values before the selected values become visible
const MAX_HIDE_MULTI_VALUES = 10;

function flattenOptions<TValue>(
    options: SelectOptionsType<TValue>,
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

function findSelectedAddress<TValue>(
    options: SelectOptionsType<TValue>,
    selected: SelectValueType<TValue>
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

export default class SelectMenu<TValue> extends React.PureComponent<Props<TValue>, State> {
    public menuRef: HTMLDivElement | null = null;
    public listRef = React.createRef<List>();
    protected cellCache = new CellMeasurerCache({
        fixedWidth   : true,
        minHeight    : 35,
        defaultHeight: 35,
    });

    constructor(props: Readonly<Props<TValue>>) {
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

    public componentDidUpdate(prevProps: Readonly<Props<TValue>>, prevState: Readonly<State>): void {
        if (prevProps.options !== this.props.options) {
            this.cellCache.clearAll();
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
        if (!this.listRef.current) {
            return;
        }

        this.listRef.current.scrollToRow(index);
    };

    protected getItemSize = (index: number): number => {
        if(typeof this.props.getItemSize === "function") {
            return this.props.getItemSize(index);
        }

        return 35;
    }

    public renderItem = ({ index, style, key, parent, columnIndex }: ListRowProps): React.ReactElement | null => {
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
        let layer: SelectOptionsType<TValue> = this.props.options;
        let option: SelectGroupType<TValue> | OptionType<TValue> | null = null;

        for (let i = 0; i < addressSize; i++) {
            const currentLayer: OptionType<TValue> = layer[address[i]];

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
                    option = { label: "Invalid Dataset", value: "" as unknown as TValue };
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
            <CellMeasurer
                cache={this.cellCache}
                rowIndex={index}
                key={key}
                parent={parent}
                columnIndex={columnIndex}
            >
                {({ registerChild }) => (
                    <SelectOption
                        ref={registerChild}
                        option={option as SelectGroupType<TValue>}
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
                        style={{
                            ...style,
                            width: "100%",
                        }}
                        iconRenderer={this.props.iconRenderer}
                    />
                )}
            </CellMeasurer>
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

        const canCreate = (this.props.input.trim() && this.props.isCreatable);

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
                {(!canCreate && !optionCount && !this.props.loading) && (
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
                    <List
                        height={this.props.height || Math.min(35 * flattenedCount, 300)}
                        estimatedRowSize={35}
                        rowCount={flattenedCount}
                        rowHeight={this.cellCache.rowHeight}
                        rowRenderer={this.renderItem}
                        onRowsRendered={this.props.onReposition}
                        overscanRowCount={20}
                        width={1}
                        deferredMeasurementCache={this.cellCache}
                        itemData={{
                            highlighted: this.props.highlighted,
                        }}
                        containerStyle={{
                            width   : "100%",
                            maxWidth: "100%",
                        }}
                        style={{
                            width: "100%",
                        }}
                        ref={this.listRef}
                    />
                )}
            </div>
        );
    }
}
