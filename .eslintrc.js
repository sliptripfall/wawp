/* eslint-env node, mocha */
/*eslint-env es6*/
module.exports = {
    "env": {
        "browser": false,
        "es6": true,
        "amd": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 6,
        "sourceType": "module",
        "ecmaFeatures": {
            "impliedSrict": true
        }
    },
    "rules": {
        "linebreak-style": [
            "error",
            "windows"
        ],
        "quotes": [
            2,
            "double"
        ],
        "semi": [
            "error",
            "never"
        ]
    }
};