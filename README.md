# 上海城中物志 · GitHub Pages 部署包

这是可直接上传到 GitHub 仓库根目录的版本。

## 在线地址结构

假设 GitHub 用户名为 `yourname`，仓库名为 `shanghai-index`：

- 展示网站：`https://yourname.github.io/shanghai-index/`
- 管理后台：`https://yourname.github.io/shanghai-index/admin/`

## 目录结构

```text
.
├── index.html                 # 展示网站入口
├── assets/                    # 网站脚本、样式、图片、地图配置
├── admin/                     # 资产管理后台
├── database/
│   └── supabase-setup.sql     # Supabase 首次初始化脚本
├── docs/                      # 点位与数据说明
├── .nojekyll                  # 防止 GitHub Pages 忽略资源
└── README.md
```

## 第一次部署前必须完成

### 1. 初始化 Supabase

进入 Supabase 项目 → `SQL Editor` → `New query`，复制并运行：

```text
database/supabase-setup.sql
```

### 2. 创建管理员账号

Supabase → `Authentication` → `Users` → `Add user`。

建议启用 `Auto Confirm User`。目前任何已登录账号都拥有后台编辑权限，因此不要开放公共注册。

### 3. 配置高德允许域名

高德开放平台中，为当前 Web 端 Key 添加 GitHub Pages 域名：

```text
yourname.github.io
```

若之后使用自定义域名，也要加入自定义域名。

## 上传 GitHub

1. 新建一个 GitHub 仓库。
2. 将本目录中的所有文件和文件夹上传到仓库根目录，不要再套一层文件夹。
3. 仓库进入 `Settings → Pages`。
4. `Source` 选择 `Deploy from a branch`。
5. Branch 选择 `main`，Folder 选择 `/(root)`。
6. 保存并等待部署完成。

## 数据同步逻辑

- 后台保存数据到 Supabase。
- 展示网站刷新后读取所有 `status = published` 的资产。
- `draft` 资产只在后台可见。
- 图片上传到 Supabase Storage 的 `exhibition-assets` bucket。

## 配置文件

浏览器端公开配置位于：

```text
assets/supabase-config.js
admin/config.js
assets/amap-config.js
```

Supabase publishable key 可以出现在前端，权限必须由 RLS 控制。不要将 `service_role` 或 Supabase secret key 上传到 GitHub。

当前高德 `securityJsCode` 直接放在前端，适合作品原型。正式商用时建议按照高德安全密钥代理方案改造。

## 初始图片路径说明

初始化 SQL 中的初始图片地址为 `assets/images/...`，适配展示网站根目录。管理后台已单独处理这些相对地址，因此后台图片预览也能正常显示。后台新上传的图片会使用 Supabase 的完整公开 URL。

## v25 资产控制台更新

本版本新增：

- 展览权重 A / B / C / D / 默认，用于控制 Object 页面物件相对尺寸。
- 区域管理：新增、改名、编辑区域中心经纬度。
- 表格全览：可像表格一样直接新增、编辑、保存、删除展品。
- 删除旧静态地图字段 `pin_x`、`pin_y`。
- 删除旧 Object 手工位置字段 `object_left`、`object_top`、`object_width`。

### 已有 Supabase 项目升级

请先在 Supabase SQL Editor 执行：

`database/supabase-migration-v25.sql`

执行后再打开 `/admin/`。区域改名时，控制台会同步更新该区域下所有资产的 `region`。

## v26 地点库升级

已有 Supabase 项目请继续执行：

```sql
-- 文件：database/supabase-migration-v26.sql
```

升级后：

- 地点在 `venues` 表中独立管理；
- 展览通过 `venue_id` 选择地点；
- `use_venue_coordinates = true` 时，前台实时读取地点库坐标；
- 切换为 `false` 后，可在展览条目中保存独立经纬度；
- 修改地点库坐标后，所有引用该地点的展览自动生效，无需逐条更新。
