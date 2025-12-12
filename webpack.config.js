const path = require("path");

module.exports = {
  entry: "./src/renderer/index.jsx",
  output: {
    path: path.resolve(__dirname, "src/renderer/dist"),
    filename: "bundle.js",
  },
  target: "electron-renderer",
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-react"],
          },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".js", ".jsx"],
  },
  devtool: "source-map",
  mode: process.env.NODE_ENV || "development",
};
