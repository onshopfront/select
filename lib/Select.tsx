import React from "react";
import SelectMenu from "./SelectMenu";
import SelectValue from "./SelectValue";
import { isCreatableValue, isGroupValue, isSelectValue } from "./SelectOption";
import { IconOption, SelectIcon } from "./SelectIcon";
import { CancellablePromise, clone, compare } from "./utilities";
import debounce from "lodash.debounce";
import _ from "lodash";
import TetherComponent from "react-tether";

type DefaultValueType = string | number | boolean | undefined | null;

export interface SelectOptionType<ValueType = DefaultValueType> {
    label: React.ReactNode;
    value: ValueType;
    additional?: Record<string, unknown>;
}

export interface SelectCreatableType {
    creatable: true;
}

export interface SelectGroupType {
    label: React.ReactNode;
    options: Array<OptionType>;
}

export type OptionType = SelectCreatableType | SelectGroupType | SelectOptionType;

export type SelectOptionsType = Array<OptionType>;
export type SelectChangeType = (option: SelectCreatableType | SelectOptionType) => void;

export type SelectOptionsPropsType = SelectOptionsType | ((value: string) => Promise<SelectOptionsType>);

export type SelectValueType<ValueType = DefaultValueType> =
    null |
    SelectOptionType<ValueType>  |
    Array<SelectOptionType<ValueType>>;

export type SelectRenderLabelType = (
    option: OptionType,
    selected: boolean,
    group: boolean
) => React.ReactNode;

export type SelectRenderValueType = (
    option: SelectValueType,
    multi: boolean
) => React.ReactNode;

export interface SelectProps {
    value: SelectValueType;
    onChange: (value: SelectValueType) => void;
    className?: string;
    menuClassName?: string;
    open?: boolean;
    options: SelectOptionsPropsType;
    placeholder?: string;
    id?: string;
    isClearable?: boolean;
    isCreatable?: boolean;
    isSearchable?: boolean;
    isMulti?: boolean;
    isLoading?: boolean;
    autoFocus?: boolean;
    noOptionsMessage?: (value: string) => string;
    createOptionMessage?: (value: string) => string;
    clearSearchOnSelect?: boolean;
    clearSearchOnClose?: boolean;
    closeOnSelect?: boolean;
    defaultOptions?: boolean;
    disabled?: boolean;
    onCreate?: (value: string) => Promise<string | SelectOptionType>;
    renderLabel?: SelectRenderLabelType;
    renderValue?: SelectRenderValueType;
    onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onEnter?: () => void;
    tabIndex?: number;
    valuePadding?: string;
    iconRenderer?: React.ComponentType<{ icon: IconOption }>;
    menuHeight?: number;
}

type Props = SelectProps;

type State = {
    firstLoad: boolean;
    loading: boolean;
    open: boolean;
    input: string;
    options: SelectOptionsType;
    selectedOptions: SelectOptionsType;
    noOptionsMessage: string;
    highlighted: Array<number>;
    width: number;
    valueWidth: number;
    maxValues: number;
    autoFocus: boolean;
}

function moveDirection(
    layer: SelectOptionsPropsType,
    current: Array<number>,
    direction: number
): Array<number> {
    if (!Array.isArray(layer)) {
        return current;
    }

    const layerSize = layer.length;
    if (!layerSize) {
        return current;
    }

    // Get index count
    const addressLength = current.length;

    // Get the index to start the search at
    let selectIndex = 0;
    let remaining = current.slice(1);
    if (addressLength > 1) {
        selectIndex = current[0];
    } else if (addressLength === 0) {
        if (direction < 0) {
            selectIndex = layerSize - 1;
        }
    } else if (addressLength === 1) {
        selectIndex = current[0] + direction;
    }

    // Loop until all options are checked
    while (selectIndex >= 0 && selectIndex < layerSize) {
        // Get the selected option
        const selected = layer[selectIndex];

        // Check to see if the selected item is a group
        if (Array.isArray((selected as SelectGroupType).options)) {
            const childMove = moveDirection((selected as SelectGroupType).options, remaining, direction);

            if (Array.isArray(childMove)) {
                return [ selectIndex, ...childMove ];
            } else if (!childMove) {
                // Ignore rest of selected address as the nested selected has reached the bounds
                remaining = [];
            }
        } else {
            return [ selectIndex ];
        }

        // Move in direction
        selectIndex += direction;
    }

    return current;
}

function searchLayer(search: string, layer: SelectOptionsType): SelectOptionsType {
    const results: SelectOptionsType = [];

    for (let i = 0, l = layer.length; i < l; i++) {
        if (Array.isArray((layer[i] as SelectGroupType).options)) {
            const children = searchLayer(search, (layer[i] as SelectGroupType).options);

            if (children.length) {
                results.push({
                    ...layer[i],
                    options: children,
                });
            }
        } else {
            const label = (layer[i] as SelectOptionType).label;

            if (typeof label === "string") {
                if (label.toLowerCase().includes(search)) {
                    results.push(layer[i]);
                }
            }
        }
    }

    return results;
}

export class Select extends React.Component<Props, State> {
    public static defaultProps = {
        isClearable        : false,
        isCreatable        : false,
        isSearchable       : true,
        clearSearchOnClose : true,
        clearSearchOnSelect: true,
    };

    public blurTimeout: null | ReturnType<typeof setTimeout> = null;
    public selectID = Math.round((Date.now() * Math.random())).toString();

    public valueRef: React.RefObject<any>  = React.createRef();
    public inputRef: React.RefObject<any>  = React.createRef();
    public selectRef: React.RefObject<any> = React.createRef();
    public tetherRef: React.RefObject<TetherComponent> = React.createRef();

    public loadingPromise?: CancellablePromise<SelectOptionsType>;

    public searchDebounce: _.DebouncedFunc<any>;
    public resizeDebounce: _.DebouncedFunc<any>;

    constructor(props: Readonly<Props>) {
        super(props);

        let noOptionsMessage = "No Options";
        if (typeof props.noOptionsMessage === "function") {
            noOptionsMessage = props.noOptionsMessage("");
        }

        const options = [];
        if (Array.isArray(props.options)) {
            options.push( ...props.options );
        }

        const selectedOptions = [];
        if (props.isMulti) {
            const selected = props.value;

            if (Array.isArray(selected)) {
                options.unshift(...selected);
                selectedOptions.push(...selected);
            }
        }

        this.state = {
            firstLoad  : !options.length,
            loading    : false,
            open       : !!props.open,
            input      : "",
            highlighted: [],
            width      : 100,
            valueWidth : 0,
            maxValues  : 4,
            autoFocus  : !!props.autoFocus,
            noOptionsMessage,
            selectedOptions,
            options,
        };

        this.searchDebounce = debounce(this.searchOptions.bind(this), 500);
        this.resizeDebounce = debounce(this.calculateFullWidth.bind(this), 50);
    }

    public componentDidMount(): void {
        window.addEventListener("mousedown", this.onWindowMouseDown);
        window.addEventListener("mouseup", this.onWindowMouseUp);
        window.addEventListener("resize", this.resizeDebounce);

        if (this.props.defaultOptions) {
            this.searchOptions("");
        }

        this.calculateWidth();
        this.calculateValueWidth();
    }

    public componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>): void {
        if (
            typeof prevProps.options !== "function" ||
            typeof this.props.options !== "function"
        ) {
            if (!compare(prevProps.options, this.props.options)) {
                this.searchOptions(this.state.input);
            }
        }

        if (!prevState.open && this.state.open) {
            if (this.props.isMulti) {
                const oldCount = prevState.selectedOptions.length;

                let newValues: Array<SelectOptionType> = [];
                if (Array.isArray(this.props.value)) {
                    newValues = this.props.value;
                }

                this.setState(prevState => ({
                    highlighted    : [],
                    selectedOptions: newValues,
                    options        : [
                        ...newValues,
                        ...prevState.options.slice(oldCount)
                    ],
                }));
            } else {
                this.setState({
                    highlighted: [],
                });
            }
        }

        if (prevProps.value !== this.props.value) {
            this.calculateValueWidth();
        }
    }

    public componentWillUnmount(): void {
        window.removeEventListener("mousedown", this.onWindowMouseDown);
        window.removeEventListener("mouseup", this.onWindowMouseUp);
        window.removeEventListener("resize", this.resizeDebounce);

        this.searchDebounce.cancel();
        this.loadingPromise?.cancel();
    }

    public getCloseOnSelect = (): boolean => {
        if (typeof this.props.closeOnSelect === "boolean") {
            return this.props.closeOnSelect;
        }

        return !this.props.isMulti;
    };

    public focus = (): void => {
        this.inputRef.current?.focus();
    };

    public calculateFullWidth = (): void => {
        this.calculateWidth();
        this.calculateValueWidth();
    };

    public calculateWidth = (): void => {
        if (!this.selectRef.current) {
            return;
        }

        const { width } = this.selectRef.current.getBoundingClientRect();

        const widthValues = Math.floor((width * 2 / 3) / 100);

        this.setState({
            maxValues: Math.max(1, Math.min(4, widthValues)),
            width,
        });
    };

    public calculateValueWidth = (): void => {
        if (!this.valueRef.current) {
            return;
        }

        const { width } = this.valueRef.current.getBoundingClientRect();

        this.setState({
            valueWidth: width,
        });
    };

    public searchOptions = (search: string): void => {
        this.setState({
            loading: true,
        });

        this.loadingPromise?.cancel();

        if (typeof this.props.options === "function") {
            this.loadingPromise = new CancellablePromise(
                this.props.options(search)
            );
        } else {
            this.loadingPromise = new CancellablePromise(Promise.resolve(
                this.searchLocally(search)
            ));
        }

        this.loadingPromise
            .promise
            .then(results => {
                const options = [ ...results ];
                if (this.props.isCreatable && !!search) {
                    options.push(({ creatable: true }) as SelectCreatableType);
                }

                const selectedOptions = [];
                if (this.props.isMulti) {
                    const selected = this.props.value;

                    if (Array.isArray(selected)) {
                        options.unshift(...selected);
                        selectedOptions.push(...selected);
                    }
                }

                this.setState({
                    highlighted: [],
                    firstLoad  : false,
                    loading    : false,
                    selectedOptions,
                    options,
                });
            })
            .catch(err => {
                if (!err.cancelled) {
                    throw err;
                }
            });
    };

    public searchLocally = async (search: string): Promise<SelectOptionsType> => {
        const needle = search.trim().toLowerCase();

        if (typeof this.props.options === "function") {
            return Promise.resolve(this.props.options(search));
        }

        if (!needle) {
            return Promise.resolve(this.props.options);
        } else {
            return Promise.resolve(searchLayer(needle, this.props.options));
        }
    };

    public onInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const value = e.currentTarget.value;

        const newState: any = {
            input  : value,
            loading: true,
        };

        if (!this.state.open) {
            newState.input = value.trim();
            newState.open  = true;
        }

        if (typeof this.props.noOptionsMessage === "function") {
            newState.noOptionsMessage = this.props.noOptionsMessage(value);
        }

        this.setState(newState);
        this.searchDebounce(value);
    };

    public onClearClick = (): void => {
        this.onClose();

        this.props.onChange((this.props.isMulti ? [] : null));
    };

    public onClose = (): void => {
        const newState: any = {
            open: false,
        };

        const resetSearch = !!this.state.input && this.props.clearSearchOnClose;
        if (resetSearch) {
            newState.input   = "";
            newState.options = [];
            newState.loading = true;

            if (typeof this.props.noOptionsMessage === "function") {
                newState.noOptionsMessage = this.props.noOptionsMessage("");
            }
        }

        this.setState(newState);

        if (resetSearch) {
            this.searchDebounce("");
        }

        this.inputRef.current?.blur();
    };

    public onIndicatorClick = (): void => {
        this.inputRef.current?.focus();
    };

    public onFocus = (e: React.FocusEvent<HTMLInputElement>): void => {
        if (typeof this.props.onFocus === "function") {
            this.props.onFocus(e);
        }

        if (this.blurTimeout) {
            clearTimeout(this.blurTimeout);
        }

        this.setState(prevState => ({
            open     : !prevState.autoFocus,
            autoFocus: false,
        }));
    };

    public onBlur = (e: React.FocusEvent<HTMLInputElement>): void => {
        if (typeof this.props.onBlur === "function") {
            this.props.onBlur(e);
        }

        this.blurTimeout = setTimeout(this.onClose, 250);
    }

    public onWindowMouseDown = (e: MouseEvent): void => {
        if (!(e.target instanceof Element)) {
            return;
        }

        if (e.target?.closest(".select-" + this.selectID)) {
            if (this.blurTimeout) {
                clearTimeout(this.blurTimeout);
            }
        }
    };

    public onWindowMouseUp = (e: MouseEvent): void => {
        if (!(e.target instanceof Element)) {
            return;
        }

        if (!e.target?.closest(".select-" + this.selectID)) {
            this.onClose();
        } else if (!e.target.closest(".select-option")){
            this.inputRef.current?.focus();
        }
    };

    public onSelect = async (option: OptionType): Promise<void> => {
        if (this.props.disabled) {
            return;
        }

        if (isCreatableValue(option) && typeof this.props.onCreate === "function") {
            const createdValue = (await this.props.onCreate(this.state.input)) as string | SelectOptionType;

            if (typeof createdValue === "string") {
                option = {
                    label: this.state.input,
                    value: createdValue,
                };
            } else {
                option = createdValue;
            }
        }

        if (isSelectValue(option)) {
            if (this.props.isMulti) {
                const value = [];

                // Check to see if value is already selected
                let found = false;
                if (Array.isArray(this.props.value)) {
                    const oldValues = this.props.value;

                    for (let i = 0, l = oldValues.length; i < l; i++) {
                        if (oldValues[i].value !== (option as SelectOptionType).value) {
                            value.push(clone(oldValues[i]));
                        } else {
                            found = true;
                        }
                    }
                }

                if (!found) {
                    value.push(clone(option));
                }

                this.props.onChange(value);
            } else {
                this.props.onChange(clone(option));
            }
        }

        if (this.getCloseOnSelect()) {
            this.onClose();
        } else {
            if (this.state.input && this.props.clearSearchOnSelect) {
                const newState: any = {
                    input    : "",
                    options  : [],
                    loading  : true,
                    firstLoad: true,
                };

                if (typeof this.props.noOptionsMessage === "function") {
                    newState.noOptionsMessage = this.props.noOptionsMessage("");
                }

                this.setState(newState);
                
                this.searchDebounce("");
            }

            requestAnimationFrame(() => {
                this.inputRef.current?.focus();
            });
        }

        this.calculateValueWidth();
    };

    public onKeyDown = (e: React.KeyboardEvent): void => {
        if (e.key === "ArrowUp") {
            this.move(-1);

            e.preventDefault();
        } else if (e.key === "ArrowDown") {
            this.move(1);

            e.preventDefault();
        } else if (e.key === "PageUp") {
            this.move(-5);

            e.preventDefault();
        } else if (e.key === "PageDown") {
            this.move(5);

            e.preventDefault();
        } else if (e.key === "Home") {
            this.setState({
                highlighted: moveDirection(this.state.options, [], 1),
            });

            e.preventDefault();
        } else if (e.key === "End") {
            this.setState({
                highlighted: moveDirection(this.state.options, [], -1),
            });

            e.preventDefault();
        } else if (e.key === "Enter") {
            this.onEnter();

            e.preventDefault();
        } else if (e.key === "Backspace" && !this.state.input) {
            this.onBackspace();

            e.preventDefault();
        }
    };

    public onBackspace = (): void => {
        if (this.state.input || !this.props.isClearable) {
            return;
        }

        if (this.props.isMulti) {
            if (!Array.isArray(this.props.value)) {
                this.props.onChange([]);
                return;
            }

            const valueCount = this.props.value.length;
            if (valueCount) {
                this.onRemove(valueCount - 1);
            }
        } else if (this.props.value) {
            this.props.onChange(null);
        }
    };

    public onEnter = (): void => {
        if (this.props.disabled) {
            return;
        }

        if (!this.state.open) {
            this.setState({
                open: true,
            });

            this.props.onEnter?.();
            return;
        }

        if (!Array.isArray(this.state.highlighted)) {
            this.props.onEnter?.();
            return;
        }

        const highlightCount = this.state.highlighted.length;
        if (!highlightCount) {
            this.props.onEnter?.();
            return;
        }

        // Loop through layers
        let layer = this.state.options;
        for (let i = 0; i < highlightCount; i++) {
            const index = this.state.highlighted[i];

            const value = layer[index];
            const isLast = i === highlightCount - 1;

            if (isGroupValue(value)) {
                if (isLast) {
                    return; // Invalid value
                } else {
                    layer = value.options;
                }
            } else if (!isLast) {
                return; // Invalid value
            }

            this.onSelect(value);
        }
    };

    public onRemove = (index: number): void => {
        if (this.props.disabled) {
            return;
        }

        if (!this.props.isMulti) {
            return;
        }

        if (!Array.isArray(this.props.value)) {
            return;
        }

        const value = [
            ...this.props.value.slice(0, index),
            ...this.props.value.slice(index + 1),
        ];

        this.props.onChange(value);
    };

    public move = (amount: number): void => {
        if (!this.state.open) {
            return;
        }

        this.setState(prevState => {
            const direction = Math.sign(amount);

            // Get the initial state
            let highlighted = prevState.highlighted as Array<number>;
            for (let i = 0, l = Math.abs(amount); i < l; i++) {
                const iteration = moveDirection(this.state.options, highlighted, direction);

                // Check to see if the move was valid
                if (!iteration) {
                    break;
                }

                highlighted = iteration;
            }

            return {
                highlighted,
            };
        });
    };

    public onHighlight = (index: Array<number>): void => {
        this.setState({
            highlighted: index,
        });
    };

    public renderTarget = (targetRef: React.RefObject<Element>): React.ReactNode => {
        let placeholder = "Select...";
        if (typeof this.props.placeholder === "string") {
            placeholder = this.props.placeholder;
        }

        let hasValue = false;
        if (this.props.isMulti) {
            if (Array.isArray(this.props.value) && this.props.value.length) {
                placeholder = "";
                hasValue    = true;
            }
        } else if (this.props.value) {
            placeholder = "";
            hasValue    = true;
        }

        // Check if the values should still be shown so they can be backspaced
        let valuePadding = "0.9em";
        if (this.props.isClearable && this.props.isMulti) {
            if (Array.isArray(this.props.value) && this.props.value.length) {
                valuePadding = `calc(${this.props.valuePadding || "1em"} + ${this.state.valueWidth}px)`;
            }
        } else if (this.props.isSearchable && this.state.input) {
            // Don't display the values
            hasValue = false;
        }

        const IconRenderer = typeof this.props.iconRenderer === "undefined" ?
            SelectIcon :
            this.props.iconRenderer;

        return (
            <div
                ref={targetRef as React.RefObject<HTMLDivElement>}
                className="select-input"
            >
                <div
                    ref={this.valueRef}
                    className="select-value-wrapper"
                >
                    {hasValue && (
                        <SelectValue
                            disabled={!!this.props.disabled}
                            isMulti={!!this.props.isMulti}
                            isClearable={!!this.props.isClearable}
                            value={this.props.value}
                            open={this.state.open}
                            input={this.state.input}
                            onRemove={this.onRemove}
                            renderValue={this.props.renderValue}
                            maxValues={this.state.maxValues}
                            iconRenderer={IconRenderer}
                        />
                    )}
                </div>
                {this.props.isSearchable ? (
                    <input
                        ref={this.inputRef}
                        id={this.props.id}
                        className="select-input-focusable"
                        placeholder={placeholder}
                        value={this.state.input}
                        onChange={this.onInputChange}
                        onFocus={this.onFocus}
                        onKeyDown={this.onKeyDown}
                        onBlur={this.onBlur}
                        autoFocus={this.props.autoFocus}
                        disabled={this.props.disabled}
                        style={{
                            paddingLeft: valuePadding,
                        }}
                        tabIndex={this.props.tabIndex}
                    />
                ) : (
                    <div
                        className="select-input-focusable"
                        ref={this.inputRef}
                        onFocus={this.onFocus}
                        onBlur={this.onBlur}
                        style={{
                            paddingLeft: valuePadding,
                        }}
                        tabIndex={this.props.tabIndex || 0}
                    />
                )}
                <div className="select-input-indicators">
                    {(this.state.loading || this.props.isLoading) && (
                        <div className="select-input-loading">
                            <IconRenderer icon="spinner" />
                        </div>
                    )}
                    {this.props.isClearable && (!!this.state.input || hasValue) && !this.props.disabled && (
                        <div
                            className="select-input-clear"
                            onClick={this.onClearClick}
                        >
                            <IconRenderer icon="remove" />
                        </div>
                    )}
                    <div
                        className="select-input-open"
                        onClick={this.onIndicatorClick}
                    >
                        {!this.props.disabled && (
                            <IconRenderer
                                icon={(this.state.open ? "caret-up" : "caret-down")}
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    public createOptionMessage = (): string => {
        if (typeof this.props.createOptionMessage === "function") {
            return this.props.createOptionMessage(this.state.input);
        }

        return `Create "${this.state.input}"`;
    };

    public onOpen = (): void => {
        this.calculateWidth();
        this.onSelectMenuReady();
    };

    public onSelectMenuReady = (): void => {
        if (this.tetherRef.current) {
            const instance = this.tetherRef.current.getTetherInstance();

            if (instance) {
                instance.position();
            }
        }
    }

    public render(): React.ReactNode {
        const classes = ["select", `select-${this.selectID}`];

        if (this.props.disabled) {
            classes.push("disabled");
        }

        if (this.props.className) {
            classes.push(this.props.className);
        }

        if (this.props.isMulti) {
            classes.push("multi-select");
        } else {
            classes.push("single-select");
        }

        return (
            <div
                ref={this.selectRef}
                className={classes.join(" ")}
            >
                <TetherComponent
                    ref={this.tetherRef}
                    attachment="top left"
                    targetAttachment="bottom left"
                    constraints={[{
                        to        : "window",
                        attachment: "together",
                        pin       : false,
                    }]}
                    renderTarget={this.renderTarget}
                    renderElement={(popupRef): React.ReactNode =>
                        (this.state.open && !this.props.disabled) && (
                        <div
                            ref={popupRef as React.RefObject<HTMLDivElement>}
                            className={
                                `select-menu-wrapper select-${this.selectID}` + (
                                    this.props.menuClassName ?
                                        ` ${this.props.menuClassName}` :
                                        ""
                                )
                            }
                            style={{
                                width: `${this.state.width - 2}px`,
                            }}
                        >
                            <SelectMenu
                                options={this.state.options}
                                noOptionsMessage={this.state.noOptionsMessage}
                                onChange={this.onSelect}
                                onHighlight={this.onHighlight}
                                highlighted={this.state.highlighted}
                                selected={this.props.value}
                                loading={this.state.loading && this.state.firstLoad}
                                isCreatable={!!this.props.isCreatable}
                                createOptionMessage={this.createOptionMessage}
                                isMulti={!!this.props.isMulti}
                                selectedLength={this.state.selectedOptions.length}
                                renderLabel={this.props.renderLabel}
                                input={this.state.input}
                                onOpen={this.onOpen}
                                onReposition={this.onSelectMenuReady}
                                iconRenderer={
                                    typeof this.props.iconRenderer === "undefined" ?
                                        SelectIcon :
                                        this.props.iconRenderer
                                }
                                height={this.props.menuHeight}
                            />
                        </div>
                    )}
                />
            </div>
        );
    }
}

/*
interface IconProps {
    icon: IconOption;
}

class NoProps extends React.Component<{testing: true}> {
    public render(): React.ReactNode {
        return undefined;
    }
}

class AnyProps extends React.Component<any> {
    public render(): React.ReactNode {
        return undefined;
    }
}

class CorrectProps extends React.Component<IconProps> {
    public render(): React.ReactNode {
        return undefined;
    }
}

const FnNoProps: React.FunctionComponent<{testing: true}> = (props) => {
    return null;
};

const FnAnyProps: React.FunctionComponent<any> = (props) => {
    return null;
};

const FnCorrectProps: React.FunctionComponent<IconProps> = (props) => {
    return null;
};

const rn = () => {
    const onChange = () => {
        // Do nothing
    };

    const a = (
        <Select
            value={null}
            options={[]}
            onChange={onChange}
            iconRenderer={NoProps}
        />
    );

    const b = (
        <Select
            value={null}
            options={[]}
            onChange={onChange}
            iconRenderer={AnyProps}
        />
    );

    const c = (
        <Select
            value={null}
            options={[]}
            onChange={onChange}
            iconRenderer={CorrectProps}
        />
    );

    const d = (
        <Select
            value={null}
            options={[]}
            onChange={onChange}
            iconRenderer={FnNoProps}
        />
    );

    const e = (
        <Select
            value={null}
            options={[]}
            onChange={onChange}
            iconRenderer={FnAnyProps}
        />
    );

    const f = (
        <Select
            value={null}
            options={[]}
            onChange={onChange}
            iconRenderer={FnCorrectProps}
        />
    );
};
*/
