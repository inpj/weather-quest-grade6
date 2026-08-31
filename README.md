# 天氣探險隊｜六上自然第一單元像素闖關

以國小六年級上學期自然科第一單元「多樣的天氣變化」為核心設計的 GitHub Pages 互動式複習遊戲。

## 目前功能
- 題庫共 50 題
- 每次闖關先洗牌，再隨機抽 10 題
- 同一輪 10 題不重複
- 單選題與複選題
- 閱讀情境、資料判讀、實驗推理、防災決策
- 提示晶片：使用後答對得 80 XP；未使用答對得 100 XP
- 3 格能量、即時解析、本輪作答紀錄
- localStorage 儲存本輪進度
- 響應式版面，可用電腦、平板與手機
- 純 HTML / CSS / JavaScript，不需 npm 或 build

## 五大冒險區
1. 水氣森林：雲、霧、雨、雹、雪、露、霜、水循環與實驗
2. 天氣圖城：衛星雲圖、地面天氣圖、等壓線與高低氣壓
3. 鋒面峽谷：氣團、冷鋒、暖鋒、滯留鋒
4. 颱風之眼：颱風形成、強度、凱米資料、防災
5. 衛星塔：福爾摩沙衛星科學閱讀

## 抽題方式
`QUESTION_BANK` 共有 50 個唯一題號，遊戲使用 Fisher–Yates shuffle 洗牌，再取前 10 題，因此同一輪不重複；下一輪會重新從完整 50 題題庫抽取。

## GitHub Pages
在 repository 的 `Settings → Pages`：
1. Build and deployment / Source 選 `Deploy from a branch`
2. Branch 選 `main`
3. Folder 選 `/(root)`
4. 按 Save

網站入口為根目錄 `index.html`。

## 檔案結構
```text
weather-quest-grade6/
├─ index.html
├─ .nojekyll
├─ css/
│  └─ game.css
├─ js/
│  ├─ questions.js
│  └─ app.js
└─ README.md
```

## 素材策略
目前畫面使用 CSS 與 emoji 自製像素視覺，未直接內嵌課本掃描頁或原版插圖，以降低公開 repository 的教材著作權風險。
