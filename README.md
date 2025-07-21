# GraphQL Explorer

GraphQL クエリの実行とテストを行う現代的な Web アプリケーション。GraphiQL や Apollo Studio に似た機能を提供し、任意の GraphQL エンドポイントに対してクエリを実行できます。

## 主な機能

- 🔍 **GraphQL クエリエディタ** - 構文ハイライト付きのクエリエディタ
- 📋 **複数エンドポイント管理** - 複数の GraphQL エンドポイントを管理・切り替え
- 📜 **クエリ履歴** - 実行したクエリの自動保存と復元
- 🎯 **変数・ヘッダー管理** - リクエストの変数とヘッダーを設定
- 📖 **スキーマドキュメント** - GraphQL スキーマの自動取得と表示
- 💾 **データのインポート/エクスポート** - 設定とデータの完全なバックアップ
- 🎨 **レスポンシブデザイン** - モバイルとデスクトップ両対応
- 📱 **Tauri デスクトップアプリ** - クロスプラットフォームのデスクトップアプリケーション

## 技術スタック

### フロントエンド

- **React 18** + **TypeScript**
- **Vite** (開発・ビルドツール)
- **Tailwind CSS** (スタイリング)
- **Radix UI** + **shadcn/ui** (UI コンポーネント)
- **TanStack Query** (状態管理)
- **Monaco Editor** (コードエディタ)
- **Wouter** (ルーティング)

### バックエンド

- **Node.js** + **Express** + **TypeScript**
- **Drizzle ORM** + **PostgreSQL** (Neon Database)
- **ES Modules** 対応

### デスクトップアプリ

- **Tauri** (Rust + WebView)

## セットアップ

### 開発サーバーの起動

```bash
# 開発サーバーを起動（フロントエンド + バックエンド）
npm run dev

# フロントエンドのみ起動
npm run dev:frontend
```

アプリケーションは `http://localhost:5173` でアクセスできます。

### Tauri デスクトップアプリ

```bash
# デスクトップアプリの開発サーバーを起動
npm run tauri:dev

# デスクトップアプリをビルド
npm run tauri:build
```

## 使用方法

### 1. エンドポイントの設定

1. 左上のエンドポイント選択から GraphQL エンドポイントを選択
2. 新しいエンドポイントを追加する場合は「新しいエンドポイント」をクリック
3. エンドポイントの URL、名前、必要に応じてヘッダーを設定

### 2. クエリの実行

1. 左パネルのクエリエディタに GraphQL クエリを入力
2. 必要に応じて変数を設定
3. 実行ボタンをクリックして結果を確認

### 3. スキーマの確認

1. 右パネルの「Schema」タブで GraphQL スキーマを確認
2. 型をクリックして詳細を表示
3. フィールドや引数の説明を確認

### 4. 履歴の管理

1. 実行したクエリは自動的に履歴に保存
2. 履歴からクエリを復元可能
3. エンドポイントごとに最大 50 件まで保存

## 開発コマンド

```bash
# TypeScriptの型チェック
npm run check

# フロントエンドのみの開発サーバー
npm run dev:frontend

# Tauriアプリの開発
npm run tauri:dev

# Tauriアプリのビルド
npm run tauri:build
```

## プロジェクト構成

```
/
├── client/                 # フロントエンドアプリケーション
│   ├── src/
│   │   ├── components/    # UIコンポーネント
│   │   ├── hooks/         # カスタムフック
│   │   ├── lib/           # ユーティリティ
│   │   └── pages/         # ページコンポーネント
│   └── index.html
├── shared/                # 共有型定義
│   └── schema.ts         # データベーススキーマ
├── src-tauri/             # Tauriデスクトップアプリ
└── package.json
```
