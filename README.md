# @onshopfront/select

An opinionated asynchronous select component for React.

## Installation

Simply install as any other node dependency

```
yarn add @onshopfront/select
```

```
npm install --save @onshopfront/select
```

## Getting Started

Import the component where ever you'd like to use it

```
import { Select } from "@onshopfront/select"

export const MyForm = () => {
    return (
        <Select />
    );
}
```

Somewhere in your application you'll also need to expose the CSS stylesheet
or implement it yourself. If you're using a code bundling tool such as webpack
this is easy. We normally import it during our bootstrapping phase for our application.

```
import "@onshopfront/select/dist/select.css"
```
