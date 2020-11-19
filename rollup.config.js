import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";
import packageJson from "./package.json";

export default [{
    input : "lib/index.ts",
    output: [{
        file  : packageJson.main,
        format: "cjs",
    }, {
        file  : packageJson.module,
        format: "esm",
    }],
    plugins: [
        commonjs(),
        resolve(),
        typescript({
            useTsconfigDeclarationDir: true,
        }),
    ],
    external: ["react", "react-dom"],
}];
