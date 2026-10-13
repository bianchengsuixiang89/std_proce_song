# 《标准流程》 — treatment & style bible (round 1)

Method and engine follow [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT): plates with their own idiom in one shared
design system, visual puns instead of literal illustration, cuts on the beat, every frame a pure function of song time `t`, scene
windows anchored to lyric lines and snapped to the beat grid (`app/src/timeline.ts`).

## What the song is about

The lyrics point at real events of the zero-COVID years. The film never names them; it uses their vocabulary.

| lyric | event / vocabulary |
|---|---|
| 穿着白色防护服的人 · 依照标准流程，进行报废处理 · 喵喵的忌日 | pets killed in their homes while their owners were in quarantine, "按流程无害化处理" (Shangrao, Nov 2021, and many cases in 2022) |
| 你说你认识局长 … 市长热线 | the 12345 hotline: a ticket that gets 办结, a satisfaction call-back |
| 开往贵州的大巴 · 一次撞击 | the quarantine transfer coach that crashed in Sandu, Guizhou, early on 18 Sept 2022 |

The film is on the side of the person. The mockery in the choruses is the system's voice, not the film's. There is no accident
spectacle: the crash exists only as data.

## One day

The whole song is one day. A clock runs in every plate's header (`dayMinutes` in `_archive.ts`): the suits come in at
08:05, the notice at 08:21, the window at 10:30, the hotline after lunch, the glass at 16:40, the cards in the evening, the
coach at 23:41. Every forecast is in hours of that day ("撑到几时": odds on 14:00 / 17:00 / 20:00).

## Real material, quoted

Two screenshots of the Shangrao case (2021.11) are quoted as documents, low-resolution and grey against the crisp system
(sources: `refs/SOURCES.md`): the home camera still (two suits, shoe covers, the pet: the animal there was a corgi) in
`fog`, between 再一次靠近你 and the visor; and the official notice (信州发布) at the end of `hotline`, its own words boxed
in red: 无害化处置 · 已取得该网民谅解 · 该群众对疫情期间的防控措施表示理解.

## The idea

**Orderly harm.** One person tries to protect a life they love and is processed: received, classified, filed, closed. The film is
an archive of that process, shown in **two media that cut against each other on the beat**:

- **PAPER**: the archive. Bone paper, charcoal ink, blue-grey print, vermilion seal ink: forms, extracts, test reports, envelopes,
  catalogue cards. The type registers of a 公文: Noto Serif SC (heads), FangSong (body), Noto Sans SC (labels), KaiTi (handwriting).
- **SCREEN**: the system. The same drawings lit up on a dark gridded display: glowing hairlines, scanlines, the red line blooming.
  Over it all, **the system's eye**: detection brackets, class tags, confidences, typed verdict panels.

The satire is done by the machine, and it is never stated outright. The system misreads everything with perfect confidence:
法律条文 → 情绪化诉求 (相关性 0.03); 检测报告 → 不予采信; the visitor's face → 估计年龄 7 岁 · 认知能力 不具备; the shouting →
[背景噪音] 0.08, then [重复内容] 已过滤; palm prints → 污渍 01/02; the grab → 异常接触 · 已记录; the wipe → 工单 已办结 · 满意度
满意（默认）; the crash → 转运任务 0918 · 状态 已完成 · 异常记录 无. The film never comments on any of it.

## The red line (红色流程线)

It plays the structural part of the pdoom spark: one vermilion line with a pen head that runs through every plate and changes
what it is. On paper it is ink: an underline, a route, a revision cloud, a proofreading rule. On screen it glows: the scan laser,
the dispatch route, the detector's alarm. It is the procedure's own instrument, so it never stands for the person.

## Design system

- Palette (`app/src/engine/palette.ts`): ink `#121314`, ink2, graphite, ash, slate `#56626C` (blue-grey shadow), fog `#C9CDCC`
  (frost, the suits), bone `#E9E4D8`, and one accent, vermilion `#C8321F` (ember `#E8604A` only where it glows, blood for dried seal ink).
- Paper and screen are one shader (`Paper` in `app/src/scenes/_archive.ts`): drawings are channel-coded inks (R ink, G print,
  B red) composited as overprinted ink on paper (`screen: 0`) or as emissive lines on a display (`screen: 1`). Misregistration
  (each plate off by its own vector) and a broken forme (bands shifted) are the only "glitches", used once, for the impact.
- People are architectural scale figures (配景人) or what frosted glass lets through: silhouettes, palms, a hand on a sleeve. No faces.
- Subtitles are their own layer (`app/src/engine/hud.ts`): the full lyric, left-aligned on the grid, synced per character
  (character-level alignment in `data/lyrics.json`), with a vermilion underline that follows the voice. In-picture text only has a
  job in its world (field names, stamps, tags, verdicts).

## Plates

**Rule: every idea appears once.** No instrument, gag or device is used twice in the film (the stamp is 已收悉 alone; the
flowchart is the SOP alone; the call audio is the hotline alone; the grid of copies is chorus 1's wall alone; the forecast
is the betting odds alone). The design language (paper/screen, brackets, tags, panels, the red line) is shared; ideas are not.

`home · fog · notice · petition · spectacle · hotline · glass · shred · index · bus (+ coda)`: all built (round 2).
Cat = 编号 0471, visitor = 0472: the queue board's flip 0471 → 0472 in `bus` is "最终会轮到你".

### home: 住处 (intro)
PAPER: the apartment in plan prints in; a paw-print trail crosses it on the beats; the owner's notes by hand (KaiTi, the
person's own voice): 晒太阳的地方 · 喵喵的碗 · 它最喜欢的纸箱. On a downbeat, SCREEN: the system's version: 无关区域 ·
宠物用品 ×2 · 活体 · 猫 · 未登记; the red line writes 0471 round the box, seals the door (已封控), plans the way in.

### fog: 白雾 (穿着白色防护服的人 … 只剩一层白雾而已)
"脸上没有五官，只剩一层白雾" is the worker: inside the suit, goggles and face shield fogged from within, a mask. PAPER: the
coverall's spec sheet (GB 19082), everything specified except 穿戴者 (可不填), boxed in red on 人. SCREEN: a proximity radar
centred on the resident; the sweep finds the suit at 4 m and it comes in to 0.4 m (今日第 2 次; this morning's first track
faint). Real material: the Shangrao home-camera still. Then the visor (shader): Tyvek hood, fogged goggles, KN95, a shield
breathing fog that turns white on 白雾; the landmark detector loses all 68 points on 五官: 身份 不适用 · 责任人 —.

### notice: 告知书 (他手里那张纸 … 进行报废处理)
PAPER: a red-headed 处置告知书 in a gloved hand; on 忌日 the red line strikes 处置日期 and writes 忌日 (the system: 手写批注 ·
无效). SCREEN: the SOP flowchart, a node per character; at 住户同意？ both branches lead to the same box. PAPER: an asset tag
(报废物品 · 资产标签 · NO. 0471 · 类别：物品) slapped on the form.

### petition: 呈递 (你问他法律条文 … 不懂事的孩子)
PAPER: the visitor's law is the Constitution (中华人民共和国宪法, verbatim: 第二条 一切权力属于人民 · 第三十三条 · 第三十五条
言论、出版、集会、结社、游行、示威的自由 · 第三十七条 · 第三十九条 住宅不受侵犯 · 第四十一条 批评、建议、申诉). The red laser
sweeps it; each article gets its status: 人民当家作主 · 权限不足 · 不适用 · 已屏蔽 · 已隔离 · 已入户 · 已转办; the red line
underlines 第二、三十五、三十九、四十一条 on 法-律-条-文; the verdict: **情绪化诉求**; 已收悉 (仅表示收到) is stamped on the beat. SCREEN: the
red line runs on as the submission route to the counter's slot, where the document drops edge-on and becomes a layer of the
partition. PAPER: the test report; 科学 traces the data, 依据 boxes each 阴性 → **不予采信**. SCREEN: the section of the counter;
the attachments drop in on the beats and the wall doubles (dimensioned in mm). His sightline is a dashed hidden line through it;
his face is 面部已脱敏. On 不懂事 a red revision cloud is drawn round the visitor; on 孩子 the age estimator rolls 34 → 7 and the
figure is redrawn with a child's proportions.

### spectacle / index: the choruses (`chorus.ts`, n = 1 | 2)
One instrument per lyric line, none repeated. Chorus 1 (SCREEN, watched live): the surveillance wall doubling 1 → 64 ·
the betting odds on 撑到几时 · the teleprompter scripting the crying · 观看人次 · then the editing desk across four lines
(高光 cut, ×2 with a laugh track, the tear ×0.25, titled 《闹剧》 and published). Chorus 2 (PAPER, archived): the card filed
into a drawer of 4,812 like it · a structural analysis waiting for the collapse (安全系数 0.6) · a tear weather radar
(橙色预警 · 局部有泪) · tears listed as a weapon · 悲伤指数 · the crowd avoiding him (回避率 98%) · the health code turning red
on 流泪 · 求饶 deleted as a redundant field · 3 % battery · news clippings burying the card (大国崛起 … 都过去了) · messages
read and never answered · 旋律识别 matching 《标准流程》.

### hotline: 热线 (你说你认识局长 … 传来没忍住的笑意)
SCREEN. The org chart: the red line climbs to 局长 (自述 · 未核实); 共同用餐 ×1 · 关系强度 0.02; on 麻烦 the node is renamed,
its ties cut: 不稳定因素 · 重点关注. The live caption of the 12345 call: 公平 → 关键词库 · 无匹配; 政绩 blacked out in red →
敏感词 · 已屏蔽; 转接 → 原单位 · 窗口 07. The call audio: the agent's channel goes flat (静音 1.00 s, dimensioned in red), then
[笑声] · 置信度 0.97. Real material: the Shangrao official notice, its own words boxed.

### glass: 毛玻璃 (你上前一步 … 让你别再继续)
The visitor behind a backlit frosted pane; the man at the window is never drawn: he is his terminal, a dismissal system
made into a game, and his cursor. Every click scores (越线制止 · 工伤申报 · 降噪 · 静音 · 连续处置), the second time the
achievement 充耳不闻; he picks 其他垃圾 from a dropdown on the person; two swipes, 一键劝返, and the experience bar fills:
晋升 · 科员 → 副科长; he clicks 暂停服务 and tops the board: 本月处置之星.

### shred: 碾碎 (像碾碎可笑的法律 · 像处理没用的道理)
PAPER: a shredder in section; the petition's law extract (underlines, 已收悉) and test report (阴性, boxed) go through
the rollers; the red line is the cut at the nip. 销毁记录: 保存期限 0 日 · 依据 标准流程.

### bus: 转运 (开往贵州的大巴 … 一个坏了的玩具) and its coda
PAPER: a window envelope (red postcode boxes, 550000 written in), the red line underlining 贵州 in the address; on 大巴 the
window is matched by a coach's window and the plate cuts from paper to SCREEN: the coach as a dispatch schematic, its grille of
numbered cells, the route strip whose stops are the procedure (受理 · 审核 · 登记 · 转运 · 处置 · 贵州). The queue board flips 0471 →
0472 on 你. The night dispatch map: contour terrain, the red head is the coach, telemetry ticks. On 撞 the head stops, the plates slip
out of register, 车速 0 · 信号丢失; on 击, black, and typed into the black: 转运任务 0918 · 状态 已完成 · 异常记录 无. PAPER: one
catalogue card (物品登记卡 0472): a scale figure lying on its side with a winding key, its outline broken; the red line comes in
from the dark along the card's lower edge and stops at the edge. Coda: two bars of stillness, then the next card (0473) slides over
it and a new rule starts. The procedure goes on.

## Technical conventions

See the reference's `docs/ENGINE.md` (the engine is the reference engine, adapted: Chinese text, this palette, subtitle HUD).
Deterministic (no `Math.random`/`Date.now`; per-frame flicker through `frameIdx`), per-character sync, cuts on beats. Data:
`analysis/analyze.py` (beat grid, 150.45 BPM, envelopes, onsets) and `analysis/align.py` (faster-whisper large-v3 + DP alignment of
the known lyric, 390/390 characters).
