![image](https://github.com/user-attachments/assets/b4ad0ed0-53cc-40a1-ad41-064008a6a74d)
# 💻 What is Screeps?

[](https://raw.githubusercontent.com/screeps/screeps/HEAD/logo.png)

[Screeps](https://screeps.com/) is a MMO RTS sandbox game for programmers, wherein the core mechanic is programming your units AI. You control your colony by writing JavaScript which operate 24/7 in the single persistent world filled by other players on par with you.

To Learn more, visit [the Steam game page](https://store.steampowered.com/app/464350/Screeps_World/)

# ♟ My Screeps AI

You will find here the script which control my units online and helped me learn Typescript.

![image](https://github.com/user-attachments/assets/50f86f12-9b72-4bc6-b162-b65c19f5f88a)

# 📁 Started form "Screeps Typescript Starter" (Template)

Screeps Typescript Starter is a starting point for a Screeps AI written in Typescript. It provides everything you need to start writing your AI whilst leaving `main.ts` as empty as possible.

You can access the original project [https://github.com/screepers/screeps-typescript-starter](https://github.com/screepers/screeps-typescript-starter)

# 🏗 How to use 

## 1. Config

Create a .env file with the path to your screeps code folder :
```js
BUILD_PATH="C:/Users/YOUR_WINDOWS_USER/AppData/Local/Screeps/scripts/screeps.com/COMPLEMENTARY_PATH/"
```
## 2. Build 
Install the project dependencies with :
```js
npm i
```
Then compile the code with the command : 
```js
npm run build
```

# 🔎 More Information

## 1. Eslint version

Eslint from version 9 and up is not supported because of conflict with "eslint-plugin-import". 

- The last version supported is 8.57.1
- Cause the following warning 
```js
npm warn deprecated @humanwhocodes/config-array@0.13.0: Use @eslint/config-array instead
npm warn deprecated @humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead
```
