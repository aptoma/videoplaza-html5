/*global module*/
var config = module.exports;

config["VP5 Test Suite"] = {
    rootPath: "../",
    environment: "browser", // or "node"
    sources: [
        "test/videoplaza-sdk-mock.js",
        "src/videoplaza-html5.js"
    ],
    tests: [
        "test/*-test.js"
    ]
};
