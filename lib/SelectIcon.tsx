import React from "react";

export type IconOption = "remove" | "checkbox" | "checkbox-checked" | "spinner" | "caret-up" | "caret-down";

interface Props {
    icon: IconOption;
}

export const SelectIcon: React.FunctionComponent<Props> = ({ icon }) => {
    let renderIcon;
    const classes = ["select-icon"];
    switch(icon) {
        case "remove":
            renderIcon = "X";
            break;
        case "checkbox":
            renderIcon = <>&#9744;</>;
            break;
        case "checkbox-checked":
            renderIcon = <>&#9745;</>;
            break;
        case "spinner":
            renderIcon = <>&#9696;</>;
            classes.push("spin");
            break;
        case "caret-down":
            classes.push("flip"); // Intentional fall through
        case "caret-up":
            renderIcon = <>&#8248;</>;
            classes.push("caret");
            break;
    }

    return (
        <div className={classes.join(" ")}>
            {renderIcon}
        </div>
    );
};
