const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.svg$/i,  // Match SVG files
        issuer: /\.[jt]sx?$/, 
        use: ['@svgr/webpack'], 
      },
      {
         test: /\.svg$/,
         use: [
           {
             loader: 'svg-url-loader',
             options: {
               limit: 10000,
             },
           },
         ],
       },  
    ],
  },
  devServer: {
    static: './public',
    port: 4848, // reactsearch2 runs on port 4747
    //port: 4748,
    historyApiFallback: true,
    allowedHosts: "all",
    webSocketServer: false
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
};
