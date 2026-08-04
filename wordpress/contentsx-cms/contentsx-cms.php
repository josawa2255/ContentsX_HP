<?php
/**
 * Plugin Name: ContentsX CMS
 * Description: ContentsX サイト用カスタム投稿タイプ・REST API（漫画事例・ニュース・お客様の声）
 * Version: 1.0.0
 * Author: ContentsX
 * Text Domain: contentsx-cms
 */

if ( ! defined( 'ABSPATH' ) ) exit;

/* WPの画像自動縮小を無効化（縦読み漫画が劣化するのを防止） */
add_filter( 'big_image_size_threshold', '__return_false' );

/* アップロード画像を自動WebP変換（サムネイル・medium・large等の生成サイズが対象） */
add_filter( 'image_editor_output_format', function( $formats ) {
    $formats['image/jpeg'] = 'image/webp';
    $formats['image/png']  = 'image/webp';
    return $formats;
});

/* ==========================================================
   0-2. 漫画PDFの一括分割（全ページ→WebP→ギャラリー）
   ----------------------------------------------------------
   漫画家の納品が「複数ページを1本にまとめたPDF」のため、
   管理画面から1発で全ページをWebP化してギャラリーに入れる。

   - サーバーの Imagick + Ghostscript でラスタライズする
     （2026-08-04 本番実測: Imagick 3.8.1 / Ghostscript 9.54.0 で動作確認済み）
   - 解像度は CXCMS_PDF_DPI。元PDFの埋め込み画像が概ね 100〜160ppi のため
     150 で十分（150/200/300dpi を実測比較し、150超は容量が増えるだけで画質は変わらなかった）
   - 1リクエスト1ページ。タイムアウトとメモリ枯渇を避けるため一括処理はしない
   ========================================================== */

if ( ! defined( 'CXCMS_PDF_DPI' ) )     define( 'CXCMS_PDF_DPI', 150 );
if ( ! defined( 'CXCMS_PDF_QUALITY' ) ) define( 'CXCMS_PDF_QUALITY', 85 );
if ( ! defined( 'CXCMS_PDF_MAX_PAGES' ) ) define( 'CXCMS_PDF_MAX_PAGES', 200 );

/**
 * PDF分割の共通ガード。問題があれば WP_Error を返す。
 */
function cxcms_pdf_guard( $pdf_id ) {
    if ( ! current_user_can( 'upload_files' ) ) {
        return new WP_Error( 'forbidden', '権限がありません' );
    }
    if ( ! class_exists( 'Imagick' ) ) {
        return new WP_Error( 'no_imagick', 'サーバーに Imagick がありません' );
    }
    $file = get_attached_file( $pdf_id );
    if ( ! $file || ! file_exists( $file ) ) {
        return new WP_Error( 'no_file', 'PDFの実体が見つかりません' );
    }
    if ( 'application/pdf' !== get_post_mime_type( $pdf_id ) ) {
        return new WP_Error( 'not_pdf', '選択されたファイルはPDFではありません' );
    }
    return $file;
}

/** ページ数を返す */
add_action( 'wp_ajax_cxcms_pdf_info', 'cxcms_ajax_pdf_info' );
function cxcms_ajax_pdf_info() {
    check_ajax_referer( 'cxcms_pdf_split', 'nonce' );
    $pdf_id = isset( $_POST['pdf_id'] ) ? (int) $_POST['pdf_id'] : 0;
    $file   = cxcms_pdf_guard( $pdf_id );
    if ( is_wp_error( $file ) ) {
        wp_send_json_error( [ 'message' => $file->get_error_message() ] );
    }
    try {
        $im = new Imagick();
        $im->pingImage( $file );          // ページ数だけ見る（実体は読まない＝軽い）
        $pages = $im->getNumberImages();
        $im->clear();
        $im->destroy();
    } catch ( Exception $e ) {
        // Imagick の policy.xml で PDF が禁止されているとここに来る
        wp_send_json_error( [ 'message' => 'PDFを読み取れません（サーバー側でPDF処理が許可されていない可能性）: ' . $e->getMessage() ] );
    }
    if ( $pages > CXCMS_PDF_MAX_PAGES ) {
        wp_send_json_error( [ 'message' => 'ページ数が多すぎます（' . $pages . 'ページ / 上限' . CXCMS_PDF_MAX_PAGES . '）' ] );
    }
    wp_send_json_success( [ 'pages' => $pages ] );
}

/** 指定1ページをWebP化してメディア登録し、添付IDを返す */
add_action( 'wp_ajax_cxcms_pdf_split_page', 'cxcms_ajax_pdf_split_page' );
function cxcms_ajax_pdf_split_page() {
    check_ajax_referer( 'cxcms_pdf_split', 'nonce' );

    $pdf_id  = isset( $_POST['pdf_id'] ) ? (int) $_POST['pdf_id'] : 0;
    $page    = isset( $_POST['page'] ) ? max( 1, (int) $_POST['page'] ) : 1;
    $post_id = isset( $_POST['post_id'] ) ? (int) $_POST['post_id'] : 0;

    $file = cxcms_pdf_guard( $pdf_id );
    if ( is_wp_error( $file ) ) {
        wp_send_json_error( [ 'message' => $file->get_error_message() ] );
    }

    // 元PDFのファイル名を引き継ぎ、ページ番号でゼロ埋め連番にする
    // （既存ギャラリーの「ファイル名の数字で並べ替え」ロジックに乗せるため）
    $base = sanitize_title( pathinfo( basename( $file ), PATHINFO_FILENAME ) );
    if ( '' === $base ) { $base = 'manga'; }
    $filename = sprintf( '%s-p%02d.webp', $base, $page );

    try {
        $im = new Imagick();
        $im->setResolution( CXCMS_PDF_DPI, CXCMS_PDF_DPI );  // ← 読み込み前に指定しないと効かない
        $im->readImage( $file . '[' . ( $page - 1 ) . ']' );  // 0始まり
        $im->setImageBackgroundColor( 'white' );              // 透過PDF対策（黒背景化を防ぐ）
        $im = $im->flattenImages();
        $im->setImageFormat( 'webp' );
        $im->setImageCompressionQuality( CXCMS_PDF_QUALITY );
        $im->stripImage();                                    // Exif等を落として軽量化
        $blob = $im->getImageBlob();
        $im->clear();
        $im->destroy();
    } catch ( Exception $e ) {
        wp_send_json_error( [ 'message' => $page . 'ページ目の変換に失敗: ' . $e->getMessage() ] );
    }

    // uploads へ書き出し（同名があれば WP が自動で -1 を付ける＝既存を壊さない）
    $up = wp_upload_bits( $filename, null, $blob );
    if ( ! empty( $up['error'] ) ) {
        wp_send_json_error( [ 'message' => '保存に失敗: ' . $up['error'] ] );
    }

    $att_id = wp_insert_attachment( [
        'post_mime_type' => 'image/webp',
        'post_title'     => sprintf( '%s %d ページ', $base, $page ),
        'post_content'   => '',
        'post_status'    => 'inherit',
    ], $up['file'], $post_id );

    if ( is_wp_error( $att_id ) || ! $att_id ) {
        wp_send_json_error( [ 'message' => 'メディア登録に失敗しました' ] );
    }

    require_once ABSPATH . 'wp-admin/includes/image.php';
    wp_update_attachment_metadata( $att_id, wp_generate_attachment_metadata( $att_id, $up['file'] ) );

    $thumb = wp_get_attachment_image_src( $att_id, 'thumbnail' );
    wp_send_json_success( [
        'id'       => $att_id,
        'thumb'    => $thumb ? $thumb[0] : $up['url'],
        'filename' => basename( $up['file'] ),
    ] );
}

/* ==========================================================
   1. カスタム投稿タイプ登録
   ========================================================== */

add_action( 'init', 'cxcms_register_post_types' );

function cxcms_register_post_types() {

    /* ── 漫画事例 ── */
    register_post_type( 'manga_work', [
        'labels' => [
            'name'               => '漫画事例',
            'singular_name'      => '漫画事例',
            'add_new'            => '新規追加',
            'add_new_item'       => '漫画事例を追加',
            'edit_item'          => '漫画事例を編集',
            'all_items'          => 'すべての漫画事例',
            'search_items'       => '漫画事例を検索',
            'not_found'          => '漫画事例が見つかりません',
            'featured_image'        => '表紙の画像',
            'set_featured_image'    => '表紙の画像を設定',
            'remove_featured_image' => '表紙の画像を削除',
            'use_featured_image'    => '表紙の画像として使用',
        ],
        'public'       => false,
        'show_ui'      => true,
        'show_in_rest' => true,        // REST API 有効
        'rest_base'    => 'manga-works',
        'menu_icon'    => 'dashicons-book-alt',
        'supports'     => [ 'title', 'thumbnail', 'custom-fields', 'page-attributes' ],
        'has_archive'  => false,
        'rewrite'      => false,
    ]);

    /* ── ニュース / お知らせ ── */
    register_post_type( 'cx_news', [
        'labels' => [
            'name'               => 'ニュース',
            'singular_name'      => 'ニュース',
            'add_new'            => '新規追加',
            'add_new_item'       => 'ニュースを追加',
            'edit_item'          => 'ニュースを編集',
            'all_items'          => 'すべてのニュース',
            'search_items'       => 'ニュースを検索',
            'not_found'          => 'ニュースが見つかりません',
        ],
        'public'       => false,
        'show_ui'      => true,
        'show_in_rest' => true,
        'rest_base'    => 'cx-news',
        'menu_icon'    => 'dashicons-megaphone',
        'supports'     => [ 'title', 'editor', 'custom-fields', 'thumbnail' ],
        'has_archive'  => false,
        'rewrite'      => false,
    ]);

    /* ── お客様の声 ── */
    register_post_type( 'cx_testimonial', [
        'labels' => [
            'name'               => 'お客様の声',
            'singular_name'      => 'お客様の声',
            'add_new'            => '新規追加',
            'add_new_item'       => 'お客様の声を追加',
            'edit_item'          => 'お客様の声を編集',
            'all_items'          => 'すべてのお客様の声',
            'search_items'       => 'お客様の声を検索',
            'not_found'          => 'お客様の声が見つかりません',
        ],
        'public'       => false,
        'show_ui'      => true,
        'show_in_menu' => 'cxcms-bizmanga',   // B専用 → ビズマンガ親メニュー配下
        'show_in_rest' => true,
        'rest_base'    => 'cx-testimonials',
        'menu_icon'    => 'dashicons-format-quote',
        'supports'     => [ 'title', 'editor', 'thumbnail' ],
        'has_archive'  => false,
        'rewrite'      => false,
    ]);

    /* ── お客様の声タグ分類 ── */
    register_taxonomy( 'testimonial_tag', 'cx_testimonial', [
        'labels' => [
            'name'          => 'タグ',
            'singular_name' => 'タグ',
            'add_new_item'  => 'タグを追加',
        ],
        'show_in_rest'  => true,
        'rest_base'     => 'testimonial-tags',
        'hierarchical'  => true,
        'show_ui'       => true,
        'show_admin_column' => true,
    ]);

    /* ── 赤ペン・ネーム ── */
    register_post_type( 'cx_preproduction', [
        'labels' => [
            'name'               => '赤ペン・ネーム',
            'singular_name'      => '赤ペン・ネーム',
            'add_new'            => '新規追加',
            'add_new_item'       => '赤ペン・ネームを追加',
            'edit_item'          => '赤ペン・ネームを編集',
            'all_items'          => 'すべての赤ペン・ネーム',
            'search_items'       => '赤ペン・ネームを検索',
            'not_found'          => '赤ペン・ネームが見つかりません',
        ],
        'public'       => false,
        'show_ui'      => true,
        'show_in_menu' => 'cxcms-bizmanga',   // B専用 → ビズマンガ親メニュー配下
        'show_in_rest' => true,
        'rest_base'    => 'cx-preproduction',
        'menu_icon'    => 'dashicons-edit',
        'supports'     => [ 'title', 'thumbnail' ],
        'has_archive'  => false,
        'rewrite'      => false,
    ]);

    /* ── カテゴリ分類（漫画事例用） ── */
    register_taxonomy( 'manga_category', 'manga_work', [
        'labels' => [
            'name'          => 'カテゴリ',
            'singular_name' => 'カテゴリ',
            'add_new_item'  => 'カテゴリを追加',
        ],
        'show_in_rest'  => true,
        'rest_base'     => 'manga-categories',
        'hierarchical'  => true,
        'show_ui'       => true,
        'show_admin_column' => true,
    ]);

    /* ── ニュースタグ分類 ── */
    register_taxonomy( 'news_tag', 'cx_news', [
        'labels' => [
            'name'          => 'タグ',
            'singular_name' => 'タグ',
            'add_new_item'  => 'タグを追加',
        ],
        'show_in_rest'  => true,
        'rest_base'     => 'news-tags',
        'hierarchical'  => true,
        'show_ui'       => true,
        'show_admin_column' => true,
    ]);
}


/* ==========================================================
   1b. サービス別親メニュー (2026-06-12 メニュー再編)
   ルール: B/C共通コンテンツ(漫画事例・ニュース・コラム)は最上階層、
          サービス専用コンテンツはサービス名親メニューの配下に置く。
   新サービス追加時は add_menu_page を増やし、専用CPTに
   'show_in_menu' => 'cxcms-<サービス>' を指定する。
   ========================================================== */

add_action( 'admin_menu', 'cxcms_register_service_parent_menus' );

function cxcms_register_service_parent_menus() {

    /* ── ビズマンガ ── */
    add_menu_page(
        'ビズマンガ',
        'ビズマンガ',
        'edit_posts',
        'cxcms-bizmanga',
        'cxcms_bizmanga_landing_page',
        'dashicons-portfolio',
        30
    );

    /* お客様の声のタグ管理（CPTを親メニュー配下に移すと
       タクソノミーのサブメニューが自動では出なくなるため明示追加） */
    add_submenu_page(
        'cxcms-bizmanga',
        'お客様の声 タグ',
        'お客様の声 タグ',
        'manage_categories',
        'edit-tags.php?taxonomy=testimonial_tag&post_type=cx_testimonial'
    );

    /* ── イチオシ採用 (2026-06-12 追加、2026-07-09 リクルートXから改名) ── */
    add_menu_page(
        'イチオシ採用',
        'イチオシ採用',
        'edit_posts',
        'cxcms-ichioshi',
        'cxcms_ichioshi_landing_page',
        'dashicons-businessperson',
        31
    );

    /* 事例タグの管理画面（タクソノミーのサブメニュー明示追加） */
    add_submenu_page(
        'cxcms-ichioshi',
        '事例タグ',
        '事例タグ',
        'manage_categories',
        'edit-tags.php?taxonomy=rx_case_tag&post_type=rx_case'
    );
}

function cxcms_bizmanga_landing_page() {
    ?>
    <div class="wrap">
        <h1>ビズマンガ</h1>
        <p>BizManga（bizmanga.contentsx.jp）専用のコンテンツ管理メニューです。</p>
        <p>複数サイト共通のコンテンツ（漫画事例・ニュース・コラム）は左メニューの最上階層にあります。</p>
        <ul style="list-style:disc;padding-left:20px;">
            <li><a href="<?php echo esc_url( admin_url( 'edit.php?post_type=cx_testimonial' ) ); ?>">お客様の声</a></li>
            <li><a href="<?php echo esc_url( admin_url( 'edit.php?post_type=cx_preproduction' ) ); ?>">赤ペン・ネーム</a></li>
        </ul>
    </div>
    <?php
}

function cxcms_ichioshi_landing_page() {
    ?>
    <div class="wrap">
        <h1>イチオシ採用</h1>
        <p>イチオシ採用（ichioshi.contentsx.jp）専用のコンテンツ管理メニューです。</p>
        <p>複数サイト共通のコンテンツ（ニュース・コラム）は左メニューの最上階層にあります。コラムは「コラム」メニューで掲載先「イチオシ採用」にチェックして管理します。</p>
        <ul style="list-style:disc;padding-left:20px;">
            <li><a href="<?php echo esc_url( admin_url( 'edit.php?post_type=rx_case' ) ); ?>">採用事例</a></li>
            <li><a href="<?php echo esc_url( admin_url( 'edit-tags.php?taxonomy=rx_case_tag&post_type=rx_case' ) ); ?>">事例タグ</a></li>
            <li><a href="<?php echo esc_url( admin_url( 'edit.php?post_type=cx_column' ) ); ?>">コラム（共有・掲載先で振り分け）</a></li>
        </ul>
    </div>
    <?php
}


/* ==========================================================
   2. カスタムフィールド（メタボックス）
   ========================================================== */

add_action( 'add_meta_boxes', 'cxcms_add_meta_boxes' );

function cxcms_add_meta_boxes() {
    add_meta_box( 'manga_work_fields', '漫画事例 詳細', 'cxcms_manga_meta_html', 'manga_work', 'normal', 'high' );
    /* Gutenberg がサイドバー化するのを防ぎ、下部メタボックス領域に固定 */
    add_meta_box(
        'cx_news_fields',
        'ニュース詳細',
        'cxcms_news_meta_html',
        'cx_news',
        'normal',
        'high',
        [ '__back_compat_meta_box' => false ]
    );
    add_meta_box( 'cx_testimonial_fields', 'お客様の声 詳細', 'cxcms_testimonial_meta_html', 'cx_testimonial', 'normal', 'high' );
    add_meta_box( 'cx_preproduction_fields', '赤ペン・ネーム 詳細', 'cxcms_preproduction_meta_html', 'cx_preproduction', 'normal', 'high' );
    /* 漫画事例 → ニュース作成 ボタン（右サイドバー） */
    add_meta_box( 'manga_create_news', '📰 ニュース作成', 'cxcms_manga_create_news_box', 'manga_work', 'side', 'high' );
}

/* 漫画→ニュース作成 ボタン UI（サイドバー版 + タイトル直下版で共有） */
function cxcms_render_create_news_button( $post, $compact = false ) {
    if ( $post->post_status === 'auto-draft' ) {
        echo '<p style="color:#666;font-size:12px;margin:0;">先に「下書き保存」または「公開」してください</p>';
        return;
    }
    $url = wp_nonce_url(
        admin_url( 'admin-post.php?action=cxcms_create_news_from_manga&manga_id=' . $post->ID ),
        'cxcms_create_news_' . $post->ID
    );
    /* 既存下書きがあるか確認 */
    $existing = get_posts([
        'post_type'      => 'cx_news',
        'post_status'    => ['draft', 'pending', 'publish'],
        'meta_key'       => 'cx_news_from_manga',
        'meta_value'     => $post->ID,
        'posts_per_page' => 1,
    ]);
    $has_existing = ! empty( $existing );

    if ( $compact ) {
        echo '<div style="display:inline-flex;align-items:center;gap:10px;margin:10px 0 16px;padding:10px 16px;background:#fff7ed;border:2px solid #EB5200;border-radius:8px;">';
        echo '<a href="' . esc_url($url) . '" class="button button-primary" style="background:#EB5200;border-color:#EB5200;font-weight:700;">📰 この漫画でニュースを作成</a>';
        if ( $has_existing ) {
            echo '<span style="font-size:12px;color:#EB5200;font-weight:700;">※ 既存下書きを開きます</span>';
        }
        echo '</div>';
    } else {
        echo '<div style="text-align:center;">';
        echo '<a href="' . esc_url($url) . '" class="button button-primary button-large" style="background:#EB5200;border-color:#EB5200;font-weight:700;width:100%;text-align:center;">📰 この漫画でニュースを作成</a>';
        echo '<p style="margin-top:10px;font-size:12px;color:#666;line-height:1.5;">表紙画像 + タイトル + 本文テンプレが入った<br>ニュース下書きを自動生成します。</p>';
        if ( $has_existing ) {
            echo '<p style="margin-top:8px;font-size:12px;color:#EB5200;font-weight:700;">⚠️ 既存の関連ニュース下書きが<br>あるためそちらを開きます</p>';
        }
        echo '</div>';
    }
}

function cxcms_manga_create_news_box( $post ) {
    cxcms_render_create_news_button( $post, false );
}

/* タイトル直下にもボタン表示 */
add_action( 'edit_form_after_title', function( $post ) {
    if ( $post->post_type !== 'manga_work' ) return;
    cxcms_render_create_news_button( $post, true );
});

/* 漫画→ニュース 作成ハンドラー */
add_action( 'admin_post_cxcms_create_news_from_manga', 'cxcms_create_news_from_manga_handler' );
function cxcms_create_news_from_manga_handler() {
    if ( ! current_user_can( 'edit_posts' ) ) wp_die( '権限がありません' );

    $manga_id = isset($_GET['manga_id']) ? (int) $_GET['manga_id'] : 0;
    if ( ! $manga_id || ! wp_verify_nonce( $_GET['_wpnonce'] ?? '', 'cxcms_create_news_' . $manga_id ) ) {
        wp_die( 'Invalid request' );
    }
    $manga = get_post( $manga_id );
    if ( ! $manga || $manga->post_type !== 'manga_work' ) wp_die( 'Manga not found' );

    /* 既存下書き/関連ニュースがあればそれを開く（重複防止） */
    $existing = get_posts([
        'post_type'      => 'cx_news',
        'post_status'    => ['draft', 'pending', 'publish'],
        'meta_key'       => 'cx_news_from_manga',
        'meta_value'     => $manga_id,
        'posts_per_page' => 1,
    ]);
    if ( ! empty( $existing ) ) {
        wp_safe_redirect( admin_url( 'post.php?post=' . $existing[0]->ID . '&action=edit' ) );
        exit;
    }

    /* テンプレ生成 */
    $m            = fn($k) => get_post_meta( $manga_id, $k, true );
    $title_ja     = $manga->post_title;
    $title_en     = $m('cx_title_en') ?: $title_ja;
    $slug         = $m('cx_work_id') ?: sanitize_title( $title_ja );
    $point        = trim( (string) $m('cx_point') );
    $library_url  = 'https://bizmanga.contentsx.jp/biz-library?manga=' . rawurlencode( $slug );

    $news_title   = sprintf( '「%s」を公開しました', $title_ja );
    $news_title_en = sprintf( 'New manga "%s" released', $title_en );

    $body_lines = [];
    $body_lines[] = sprintf( 'このたび、新作マンガ「%s」を公開いたしました。', $title_ja );
    $body_lines[] = '';
    if ( $point !== '' ) {
        $body_lines[] = $point;
        $body_lines[] = '';
    }
    $body_lines[] = 'ぜひご覧ください。';
    $body_lines[] = sprintf( '👉 ビズ書庫で読む: %s', $library_url );
    $news_content = implode( "\n", $body_lines );

    $body_lines_en = [];
    $body_lines_en[] = sprintf( 'We are pleased to release our new manga "%s".', $title_en );
    $body_lines_en[] = '';
    $body_lines_en[] = 'Please take a look.';
    $body_lines_en[] = sprintf( '👉 Read on Biz Library: %s', $library_url );
    $news_content_en = implode( "\n", $body_lines_en );

    /* ニュース下書き作成 */
    $news_id = wp_insert_post([
        'post_type'    => 'cx_news',
        'post_status'  => 'draft',
        'post_title'   => $news_title,
        'post_content' => $news_content,
    ], true );

    if ( is_wp_error( $news_id ) ) wp_die( 'ニュース作成失敗: ' . $news_id->get_error_message() );

    /* 表紙画像をアイキャッチに引き継ぐ */
    $thumb_id = get_post_thumbnail_id( $manga_id );
    if ( $thumb_id ) {
        set_post_thumbnail( $news_id, $thumb_id );
    }

    /* メタ情報セット */
    update_post_meta( $news_id, 'cx_news_from_manga', $manga_id );
    update_post_meta( $news_id, 'cx_news_title_en', $news_title_en );
    update_post_meta( $news_id, 'cx_news_content_en', $news_content_en );
    update_post_meta( $news_id, 'cx_news_show_site', 'both' );
    update_post_meta( $news_id, 'cx_news_url', '' );

    /* タグ「お知らせ」を自動付与（既に存在すれば紐付け、なければ作成） */
    wp_set_object_terms( $news_id, 'お知らせ', 'news_tag' );

    /* 編集画面へリダイレクト */
    wp_safe_redirect( admin_url( 'post.php?post=' . $news_id . '&action=edit&from_manga=1' ) );
    exit;
}

/* 編集画面で「漫画から自動生成された」旨のお知らせを表示 */
add_action( 'admin_notices', function() {
    $screen = get_current_screen();
    if ( ! $screen || $screen->post_type !== 'cx_news' ) return;
    if ( empty( $_GET['from_manga'] ) ) return;
    echo '<div class="notice notice-success"><p>📰 漫画事例から自動生成しました。タイトル・本文・公開設定を確認して「公開」してください。</p></div>';
});

/* Hero順番ドラッグ並べ替え 保存ハンドラー */
add_action( 'wp_ajax_cxcms_hero_reorder', 'cxcms_hero_reorder_handler' );
function cxcms_hero_reorder_handler() {
    if ( ! current_user_can( 'edit_posts' ) ) wp_send_json_error( '権限なし' );
    if ( ! wp_verify_nonce( $_POST['nonce'] ?? '', 'cxcms_hero_reorder' ) ) wp_send_json_error( 'nonce不正' );

    $site = $_POST['site'] ?? '';
    if ( ! in_array( $site, ['bm', 'cx'], true ) ) wp_send_json_error( 'site不正' );

    $ids_raw = $_POST['ids'] ?? '[]';
    $ids = json_decode( wp_unslash( $ids_raw ), true );
    if ( ! is_array( $ids ) ) wp_send_json_error( 'ids不正' );

    $meta_key = $site === 'bm' ? 'cx_hero_order_bm' : 'cx_hero_order_cx';
    $count = 0;
    foreach ( $ids as $idx => $post_id ) {
        $post_id = (int) $post_id;
        if ( $post_id <= 0 ) continue;
        $p = get_post( $post_id );
        if ( ! $p || $p->post_type !== 'manga_work' ) continue;
        update_post_meta( $post_id, $meta_key, $idx + 1 );
        $count++;
    }
    wp_send_json_success([ 'updated' => $count ]);
}

/* ── 漫画事例 メタボックス HTML ── */
function cxcms_manga_meta_html( $post ) {
    wp_nonce_field( 'cxcms_manga_save', 'cxcms_manga_nonce' );
    $m = fn($k) => get_post_meta( $post->ID, $k, true );
    ?>
    <style>
        .cx-field{margin:10px 0}.cx-field label{display:block;font-weight:700;margin-bottom:4px}
        .cx-field input,.cx-field textarea,.cx-field select{width:100%;padding:6px 8px}
        .cx-field textarea{min-height:80px}
        .cx-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .cx-hint{color:#666;font-size:12px;margin-top:2px}
    </style>
    <div class="cx-row">
        <div class="cx-field">
            <label>ID（フォルダ名）</label>
            <input name="cx_work_id" value="<?php echo esc_attr($m('cx_work_id')); ?>">
            <div class="cx-hint">material/manga/{ID}/ の画像と対応</div>
        </div>
        <div class="cx-field">
            <label>タイトル（英語）</label>
            <input name="cx_title_en" value="<?php echo esc_attr($m('cx_title_en')); ?>">
        </div>
    </div>
    <div class="cx-row">
        <div class="cx-field">
            <label>サブタイトル（日本語）</label>
            <input name="cx_subtitle_ja" value="<?php echo esc_attr($m('cx_subtitle_ja')); ?>" placeholder="空欄ならタイトルを使用">
            <div class="cx-hint">ホームの「ギャラリー」「新作情報」セクションで表示される名前。空欄時はタイトルと同じ</div>
        </div>
        <div class="cx-field">
            <label>サブタイトル（英語）</label>
            <input name="cx_subtitle_en" value="<?php echo esc_attr($m('cx_subtitle_en')); ?>" placeholder="Leave blank to use title">
        </div>
    </div>
    <div class="cx-row">
        <div class="cx-field">
            <label>ページ数</label>
            <input type="number" name="cx_pages" value="<?php echo esc_attr($m('cx_pages')); ?>">
        </div>
        <div class="cx-field">
            <label>クライアント名</label>
            <input name="cx_client" value="<?php echo esc_attr($m('cx_client')); ?>">
        </div>
    </div>
    <div class="cx-field" style="background:#fff7ed;padding:12px;border-left:4px solid #EB5200;border-radius:4px;">
        <label style="color:#EB5200;font-weight:700;">📣 BizMangaビズ書庫 最終ページCTA</label>
        <div class="cx-hint" style="margin-bottom:10px;">漫画を読み終わった最終ページに「公式サイトを見る」ボタンを表示。表示ON/OFFは右下のチェックボックスで切替。</div>
        <div class="cx-row">
            <div class="cx-field">
                <label>クライアント公式URL</label>
                <input name="cx_client_url" value="<?php echo esc_attr($m('cx_client_url')); ?>" placeholder="https://example.co.jp">
                <div class="cx-hint">CTAボタンの遷移先URL</div>
            </div>
            <div class="cx-field">
                <label>CTAラベル（日本語）</label>
                <input name="cx_cta_label_ja" value="<?php echo esc_attr($m('cx_cta_label_ja')); ?>" placeholder="例: 公式サイトを見る →／採用情報を見る">
                <div class="cx-hint">空欄時は「公式サイトを見る →」</div>
            </div>
            <div class="cx-field">
                <label>CTAラベル（英語）</label>
                <input name="cx_cta_label_en" value="<?php echo esc_attr($m('cx_cta_label_en')); ?>" placeholder="例: Visit Official Site →">
                <div class="cx-hint">空欄時は「Visit Official Site →」</div>
                <label style="display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;background:#fff;border:2px solid #EB5200;border-radius:6px;cursor:pointer;font-weight:700;color:#EB5200;">
                    <input type="checkbox" name="cx_cta_enabled" value="1" <?php checked($m('cx_cta_enabled'), '1'); ?> style="width:18px;height:18px;margin:0;">
                    CTAボタンを表示する
                </label>
                <div class="cx-hint">チェック ON のときのみCTAが最終ページに表示されます</div>
            </div>
        </div>
    </div>
    <div class="cx-row">
        <div class="cx-field">
            <label>制作ページ数</label>
            <input name="cx_spec_pages" value="<?php echo esc_attr($m('cx_spec_pages')); ?>" placeholder="例: 15P">
        </div>
        <div class="cx-field">
            <label>制作期間</label>
            <input name="cx_spec_period" value="<?php echo esc_attr($m('cx_spec_period')); ?>" placeholder="例: 10日間">
        </div>
    </div>
    <div class="cx-field">
        <label>使用メディア（カンマ区切り）</label>
        <input name="cx_media" value="<?php echo esc_attr($m('cx_media')); ?>" placeholder="営業資料, Webサイト, SNS">
    </div>
    <div class="cx-field">
        <label>漫画のポイント</label>
        <textarea name="cx_point"><?php echo esc_textarea($m('cx_point')); ?></textarea>
    </div>
    <div class="cx-field">
        <label>お客様の声</label>
        <textarea name="cx_comment"><?php echo esc_textarea($m('cx_comment')); ?></textarea>
    </div>
    <div class="cx-row">
        <div class="cx-field">
            <label>表示順（数字が小さい＝先に表示）</label>
            <input type="number" name="cx_sort_order" value="<?php echo esc_attr($m('cx_sort_order') ?: '0'); ?>">
        </div>
        <div class="cx-field">
            <label style="display:flex;align-items:center;gap:8px;margin-top:24px;padding:8px 10px;background:#f0f7ff;border:2px solid #2563eb;border-radius:6px;cursor:pointer;font-weight:700;color:#2563eb;">
                <input type="checkbox" name="cx_vertical_read" value="1" <?php checked($m('cx_vertical_read'), '1'); ?> style="width:18px;height:18px;margin:0;">
                縦読みモード
            </label>
            <div class="cx-hint">ONにすると縦スクロールで表示（Webtoon・縦読み漫画用）</div>
        </div>
    </div>
    <?php
    // 後方互換: 旧 cx_show_hero ('1'/'0') → 新 cx_show_hero_site
    $hero_site_raw = $m('cx_show_hero_site');
    if ( empty($hero_site_raw) ) {
        $hero_site_raw = $m('cx_show_hero') !== '0' ? 'both' : 'none';
    }
    $hero_disabled = ( $hero_site_raw === 'none' );
    ?>
    <?php
    /* Hero対象の全作品を取得（順番昇順）→ ドラッグ並べ替え用UIに渡す */
    $hero_works_all = get_posts([
        'post_type'      => 'manga_work',
        'posts_per_page' => 200,
        'post_status'    => 'publish',
        'orderby'        => 'title',
        'order'          => 'ASC',
    ]);
    $hero_bm_list = []; $hero_cx_list = [];
    foreach ( $hero_works_all as $w ) {
        $w_meta = fn($k) => get_post_meta( $w->ID, $k, true );
        $site_raw = $w_meta('cx_show_hero_site');
        if ( empty($site_raw) ) {
            $site_raw = $w_meta('cx_show_hero') !== '0' ? 'both' : 'none';
        }
        if ( $site_raw === 'none' ) continue;
        $thumb_id = get_post_thumbnail_id( $w->ID );
        $thumb_url = '';
        if ( $thumb_id ) {
            $img = wp_get_attachment_image_src( $thumb_id, 'thumbnail' );
            if ( $img ) $thumb_url = $img[0];
        }
        $entry = [
            'id'    => $w->ID,
            'title' => $w->post_title,
            'thumb' => $thumb_url,
        ];
        if ( $site_raw === 'both' || $site_raw === 'bizmanga' ) {
            $entry['order'] = (int) ( $w_meta('cx_hero_order_bm') ?: 9999 );
            $hero_bm_list[] = $entry;
        }
        if ( $site_raw === 'both' || $site_raw === 'contentsx' ) {
            $entry['order'] = (int) ( $w_meta('cx_hero_order_cx') ?: 9999 );
            $hero_cx_list[] = $entry;
        }
    }
    usort( $hero_bm_list, fn($a, $b) => $a['order'] - $b['order'] );
    usort( $hero_cx_list, fn($a, $b) => $a['order'] - $b['order'] );
    $current_id = $post->ID;
    ?>
    <div class="cx-field cx-hero-panel" style="background:#f0f7ff;padding:14px 16px 12px;border-left:4px solid #2563EB;border-radius:4px;">
        <label style="color:#2563EB;font-weight:700;display:flex;align-items:center;gap:6px;margin-bottom:4px;">🎬 Heroカルーセル設定</label>
        <div class="cx-hint" style="margin-bottom:12px;">トップページの背景カルーセル表示。<strong>サムネイルをドラッグで並べ替え</strong>できます。PC=3行 / タブレット=4行 / スマホ=5行に自動振り分け。</div>

        <div class="cx-field" style="margin:0 0 16px;">
            <label style="font-size:13px;">表示先</label>
            <select name="cx_show_hero_site" id="cx_show_hero_site">
                <option value="both" <?php selected($hero_site_raw, 'both'); ?>>両方（B + C）</option>
                <option value="bizmanga" <?php selected($hero_site_raw, 'bizmanga'); ?>>BizMangaのみ</option>
                <option value="contentsx" <?php selected($hero_site_raw, 'contentsx'); ?>>ContentsXのみ</option>
                <option value="none" <?php selected($hero_site_raw, 'none'); ?>>表示しない</option>
            </select>
        </div>

        <div class="cx-hero-detail" style="<?php echo $hero_disabled ? 'opacity:0.4;pointer-events:none;' : ''; ?>">
            <!-- BizManga ドラッグ並べ替え -->
            <div style="margin-bottom:18px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <strong style="color:#EB5200;font-size:13px;">📚 BizManga カルーセル順番</strong>
                    <span class="cx-hero-status" data-site="bm" style="font-size:11px;color:#666;"></span>
                </div>
                <div class="cx-hero-sortable" data-site="bm" data-current="<?php echo (int) $current_id; ?>"
                    style="display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:#fff;border:1px dashed #cbd5e1;border-radius:6px;min-height:96px;">
                    <?php foreach ( $hero_bm_list as $item ): ?>
                        <div class="cx-hero-thumb<?php echo $item['id'] == $current_id ? ' is-current' : ''; ?>"
                             data-id="<?php echo (int) $item['id']; ?>"
                             title="<?php echo esc_attr( $item['title'] ); ?>"
                             style="position:relative;cursor:grab;width:60px;<?php echo $item['id'] == $current_id ? 'box-shadow:0 0 0 3px #EB5200;' : ''; ?>">
                            <?php if ( $item['thumb'] ): ?>
                                <img src="<?php echo esc_url( $item['thumb'] ); ?>" alt="<?php echo esc_attr( $item['title'] ); ?>"
                                     style="width:60px;height:80px;object-fit:cover;border-radius:4px;display:block;">
                            <?php else: ?>
                                <div style="width:60px;height:80px;background:#eee;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;text-align:center;padding:4px;">No Img</div>
                            <?php endif; ?>
                            <span class="cx-hero-num" style="position:absolute;top:-4px;left:-4px;background:#EB5200;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;line-height:20px;text-align:center;"></span>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- ContentsX ドラッグ並べ替え -->
            <div style="margin-bottom:10px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <strong style="color:#E91E63;font-size:13px;">✨ ContentsX カルーセル順番</strong>
                    <span class="cx-hero-status" data-site="cx" style="font-size:11px;color:#666;"></span>
                </div>
                <div class="cx-hero-sortable" data-site="cx" data-current="<?php echo (int) $current_id; ?>"
                    style="display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:#fff;border:1px dashed #cbd5e1;border-radius:6px;min-height:96px;">
                    <?php foreach ( $hero_cx_list as $item ): ?>
                        <div class="cx-hero-thumb<?php echo $item['id'] == $current_id ? ' is-current' : ''; ?>"
                             data-id="<?php echo (int) $item['id']; ?>"
                             title="<?php echo esc_attr( $item['title'] ); ?>"
                             style="position:relative;cursor:grab;width:60px;<?php echo $item['id'] == $current_id ? 'box-shadow:0 0 0 3px #E91E63;' : ''; ?>">
                            <?php if ( $item['thumb'] ): ?>
                                <img src="<?php echo esc_url( $item['thumb'] ); ?>" alt="<?php echo esc_attr( $item['title'] ); ?>"
                                     style="width:60px;height:80px;object-fit:cover;border-radius:4px;display:block;">
                            <?php else: ?>
                                <div style="width:60px;height:80px;background:#eee;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;text-align:center;padding:4px;">No Img</div>
                            <?php endif; ?>
                            <span class="cx-hero-num" style="position:absolute;top:-4px;left:-4px;background:#E91E63;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;line-height:20px;text-align:center;"></span>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <details style="margin-top:8px;">
                <summary style="cursor:pointer;font-size:12px;color:#666;">⚙️ 数値で直接指定（ドラッグの代わり）</summary>
                <div class="cx-row" style="margin-top:8px;">
                    <div class="cx-field" style="margin:0;">
                        <label style="font-size:12px;color:#EB5200;">BizManga 順番</label>
                        <input type="number" name="cx_hero_order_bm" id="cx_hero_order_bm_input" value="<?php echo esc_attr($m('cx_hero_order_bm') ?: ''); ?>" placeholder="空欄＝末尾" min="1">
                    </div>
                    <div class="cx-field" style="margin:0;">
                        <label style="font-size:12px;color:#E91E63;">ContentsX 順番</label>
                        <input type="number" name="cx_hero_order_cx" id="cx_hero_order_cx_input" value="<?php echo esc_attr($m('cx_hero_order_cx') ?: ''); ?>" placeholder="空欄＝末尾" min="1">
                    </div>
                </div>
            </details>
        </div>
    </div>
    <?php wp_nonce_field( 'cxcms_hero_reorder', 'cxcms_hero_reorder_nonce' ); ?>
    <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js"></script>
    <style>
        .cx-hero-thumb { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .cx-hero-thumb:hover { transform: translateY(-2px); }
        .cx-hero-thumb.sortable-chosen { opacity: 0.6; cursor: grabbing; }
        .cx-hero-thumb.sortable-ghost { opacity: 0.3; }
        .cx-hero-status.saving { color: #2563EB; }
        .cx-hero-status.saved { color: #059669; }
        .cx-hero-status.error { color: #dc2626; }
    </style>
    <script>
    (function(){
        var sel = document.getElementById('cx_show_hero_site');
        if (sel) {
            var detail = sel.closest('.cx-hero-panel').querySelector('.cx-hero-detail');
            sel.addEventListener('change', function(){
                var off = this.value === 'none';
                detail.style.opacity = off ? '0.4' : '';
                detail.style.pointerEvents = off ? 'none' : '';
            });
        }

        if (typeof Sortable === 'undefined') return;
        var nonce = document.getElementById('cxcms_hero_reorder_nonce').value;
        var ajaxUrl = '<?php echo esc_js( admin_url('admin-ajax.php') ); ?>';

        function refreshNumbers(container) {
            container.querySelectorAll('.cx-hero-thumb').forEach(function(el, idx) {
                var num = el.querySelector('.cx-hero-num');
                if (num) num.textContent = idx + 1;
            });
        }
        function setStatus(site, text, cls) {
            var status = document.querySelector('.cx-hero-status[data-site="' + site + '"]');
            if (!status) return;
            status.textContent = text;
            status.className = 'cx-hero-status' + (cls ? ' ' + cls : '');
        }
        function syncCurrentInput(site, container) {
            var current = container.dataset.current;
            var thumbs = container.querySelectorAll('.cx-hero-thumb');
            for (var i = 0; i < thumbs.length; i++) {
                if (thumbs[i].dataset.id === current) {
                    var input = document.getElementById('cx_hero_order_' + site + '_input');
                    if (input) input.value = i + 1;
                    return;
                }
            }
        }
        function saveOrder(site, container) {
            var ids = Array.from(container.querySelectorAll('.cx-hero-thumb')).map(function(el) {
                return el.dataset.id;
            });
            setStatus(site, '保存中...', 'saving');
            var fd = new FormData();
            fd.append('action', 'cxcms_hero_reorder');
            fd.append('nonce', nonce);
            fd.append('site', site);
            fd.append('ids', JSON.stringify(ids));
            fetch(ajaxUrl, { method: 'POST', body: fd, credentials: 'same-origin' })
                .then(function(r) { return r.json(); })
                .then(function(json) {
                    if (json && json.success) {
                        var d = new Date();
                        setStatus(site, '✓ 保存しました ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2,'0'), 'saved');
                    } else {
                        setStatus(site, '保存失敗: ' + (json && json.data ? json.data : 'エラー'), 'error');
                    }
                })
                .catch(function(e) {
                    setStatus(site, '通信エラー', 'error');
                });
        }

        document.querySelectorAll('.cx-hero-sortable').forEach(function(container) {
            var site = container.dataset.site;
            refreshNumbers(container);
            syncCurrentInput(site, container);
            new Sortable(container, {
                animation: 180,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                onEnd: function() {
                    refreshNumbers(container);
                    syncCurrentInput(site, container);
                    saveOrder(site, container);
                }
            });
        });
    })();
    </script>
    <div class="cx-field">
        <label>BizManga ギャラリーに表示</label>
        <select name="cx_show_gallery_bizmanga">
            <option value="0" <?php selected($m('cx_show_gallery_bizmanga') ?: ($m('cx_is_new') === '1' ? '1' : '0'), '0'); ?>>表示しない</option>
            <option value="1" <?php selected($m('cx_show_gallery_bizmanga') ?: ($m('cx_is_new') === '1' ? '1' : '0'), '1'); ?>>表示する</option>
        </select>
        <div class="cx-hint">BizMangaトップページの「ギャラリー」セクションに表示されます</div>
    </div>
    <div class="cx-field">
        <label>ContentsX 新作情報に表示</label>
        <select name="cx_show_new_contentsx">
            <option value="0" <?php selected($m('cx_show_new_contentsx') ?: ($m('cx_is_new') === '1' ? '1' : '0'), '0'); ?>>表示しない</option>
            <option value="1" <?php selected($m('cx_show_new_contentsx') ?: ($m('cx_is_new') === '1' ? '1' : '0'), '1'); ?>>表示する</option>
        </select>
        <div class="cx-hint">ContentsXトップページの「新作情報」セクションに表示されます</div>
    </div>
    <div class="cx-field">
        <label>追加日</label>
        <input type="date" name="cx_added_date" value="<?php echo esc_attr($m('cx_added_date')); ?>">
    </div>
    <div class="cx-field">
        <label>ビズ書庫に表示</label>
        <select name="cx_show_library">
            <option value="1" <?php selected($m('cx_show_library'), '1'); ?>>表示する</option>
            <option value="0" <?php selected($m('cx_show_library'), '0'); ?>>表示しない</option>
        </select>
        <div class="cx-hint">「表示する」にするとビズ書庫（漫画を読むページ）に出ます。デフォルトは表示する</div>
    </div>
    <div class="cx-field">
        <label>BizManga 制作事例に表示</label>
        <select name="cx_show_site">
            <option value="both" <?php selected($m('cx_show_site'), 'both'); ?>>表示する</option>
            <option value="contentsx" <?php selected($m('cx_show_site'), 'contentsx'); ?>>表示しない</option>
        </select>
        <div class="cx-hint">BizMangaサイトの制作事例ページに表示するか選べます。ContentsX新作情報は上の項目で個別に設定</div>
    </div>
    <div class="cx-field" style="background:#fef2f2;padding:12px;border-left:4px solid #dc2626;border-radius:4px;">
        <label style="color:#dc2626;font-weight:700;">🔒 完全非公開（QR URLからもアクセス不可）</label>
        <select name="cx_private">
            <option value="0" <?php selected($m('cx_private') ?: '0', '0'); ?>>公開（通常）</option>
            <option value="1" <?php selected($m('cx_private'), '1'); ?>>完全非公開</option>
        </select>
        <div class="cx-hint" style="color:#dc2626;">「完全非公開」にすると全エンドポイント（書庫・ギャラリー・新作情報・QR直リンク）から除外されます。WP管理画面でのみ閲覧可能</div>
    </div>
    <div class="cx-field">
        <label>ギャラリー画像（漫画ページ）— ドラッグで並べ替え可能</label>
        <input type="hidden" name="cx_gallery" id="cx_gallery" value="<?php echo esc_attr($m('cx_gallery')); ?>">
        <div id="cx_gallery_preview" style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;">
        <?php
        $gallery_ids = $m('cx_gallery');
        if ($gallery_ids) {
            $idx = 1;
            foreach (array_filter(array_map('trim', explode(',', $gallery_ids))) as $att_id) {
                $img = wp_get_attachment_image_src((int)$att_id, 'thumbnail');
                if ($img) {
                    $fname = basename(get_attached_file((int)$att_id) ?: '');
                    echo '<div class="cx-gallery-item" data-id="'.esc_attr($att_id).'" data-filename="'.esc_attr($fname).'" style="position:relative;cursor:grab;user-select:none;">'
                        .'<div style="position:absolute;top:-4px;left:-4px;background:var(--accent,#0073aa);color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;line-height:20px;text-align:center;z-index:1;" class="cx-gallery-num">'.$idx.'</div>'
                        .'<img src="'.esc_url($img[0]).'" style="width:60px;height:80px;object-fit:cover;border:2px solid #ddd;border-radius:4px;">'
                        .'<span class="cx-gallery-remove" data-id="'.esc_attr($att_id).'" style="position:absolute;top:-6px;right:-6px;background:#e00;color:#fff;border-radius:50%;width:18px;height:18px;font-size:12px;line-height:18px;text-align:center;cursor:pointer;z-index:2;">×</span>'
                        .'</div>';
                    $idx++;
                }
            }
        }
        ?>
        </div>
        <button type="button" id="cx_gallery_btn" class="button">画像を追加</button>
        <button type="button" id="cx_pdf_split_btn" class="button button-primary" style="margin-left:6px;">PDFから一括取り込み</button>
        <span id="cx_pdf_split_status" style="margin-left:10px;font-size:12px;color:#555;"></span>
        <div class="cx-hint">漫画の各ページ画像をアップロード（表紙は右サイドバーの「表紙の画像」で設定）。ドラッグで順番変更可。ファイル名の番号順で自動ソートされます。</div>
        <div class="cx-hint">「PDFから一括取り込み」＝漫画1本のPDFを選ぶと、全ページを1枚ずつWebPに変換してこのギャラリーへページ順に追加します（既存の画像は残ります）。処理中はページを閉じないでください。</div>
    </div>
    <div class="cx-field">
        <label>赤ペン画像 — ドラッグで並べ替え可能</label>
        <input type="hidden" name="cx_akapen_gallery" id="cx_akapen_gallery" value="<?php echo esc_attr($m('cx_akapen_gallery')); ?>">
        <div id="cx_akapen_gallery_preview" style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;">
        <?php
        $akapen_ids = $m('cx_akapen_gallery');
        if ($akapen_ids) {
            $idx = 1;
            foreach (array_filter(array_map('trim', explode(',', $akapen_ids))) as $att_id) {
                $img = wp_get_attachment_image_src((int)$att_id, 'thumbnail');
                if ($img) {
                    echo '<div class="cx-gallery-item cx-akapen-item" data-id="'.esc_attr($att_id).'" draggable="true" style="position:relative;cursor:grab;user-select:none;">'
                        .'<div style="position:absolute;top:-4px;left:-4px;background:#e53935;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;line-height:20px;text-align:center;z-index:1;" class="cx-gallery-num">'.$idx.'</div>'
                        .'<img src="'.esc_url($img[0]).'" style="width:60px;height:80px;object-fit:cover;border:2px solid #e53935;border-radius:4px;">'
                        .'<span class="cx-gallery-remove cx-akapen-remove" data-id="'.esc_attr($att_id).'" style="position:absolute;top:-6px;right:-6px;background:#e00;color:#fff;border-radius:50%;width:18px;height:18px;font-size:12px;line-height:18px;text-align:center;cursor:pointer;z-index:2;">×</span>'
                        .'</div>';
                    $idx++;
                }
            }
        }
        ?>
        </div>
        <button type="button" id="cx_akapen_gallery_btn" class="button">赤ペン画像を追加</button>
        <div class="cx-hint">赤ペン（添削済み）の画像をアップロード。ホームの制作事例モーダルに表示されます。</div>
    </div>
    <div class="cx-field">
        <label>ネーム画像 — ドラッグで並べ替え可能</label>
        <input type="hidden" name="cx_name_gallery" id="cx_name_gallery" value="<?php echo esc_attr($m('cx_name_gallery')); ?>">
        <div id="cx_name_gallery_preview" style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;">
        <?php
        $name_ids = $m('cx_name_gallery');
        if ($name_ids) {
            $idx = 1;
            foreach (array_filter(array_map('trim', explode(',', $name_ids))) as $att_id) {
                $img = wp_get_attachment_image_src((int)$att_id, 'thumbnail');
                if ($img) {
                    echo '<div class="cx-gallery-item cx-name-item" data-id="'.esc_attr($att_id).'" draggable="true" style="position:relative;cursor:grab;user-select:none;">'
                        .'<div style="position:absolute;top:-4px;left:-4px;background:#ff9800;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;line-height:20px;text-align:center;z-index:1;" class="cx-gallery-num">'.$idx.'</div>'
                        .'<img src="'.esc_url($img[0]).'" style="width:60px;height:80px;object-fit:cover;border:2px solid #ff9800;border-radius:4px;">'
                        .'<span class="cx-gallery-remove cx-name-remove" data-id="'.esc_attr($att_id).'" style="position:absolute;top:-6px;right:-6px;background:#e00;color:#fff;border-radius:50%;width:18px;height:18px;font-size:12px;line-height:18px;text-align:center;cursor:pointer;z-index:2;">×</span>'
                        .'</div>';
                    $idx++;
                }
            }
        }
        ?>
        </div>
        <button type="button" id="cx_name_gallery_btn" class="button">ネーム画像を追加</button>
        <div class="cx-hint">ネーム（下書き）の画像をアップロード。ホームの制作事例モーダルに表示されます。</div>
    </div>
    <script>
    jQuery(function($){
        // ページ番号を振り直す
        function reNumber() {
            $('#cx_gallery_preview .cx-gallery-num').each(function(i){ $(this).text(i+1); });
        }
        // hidden input を並び順で更新
        function syncIds() {
            var ids = [];
            $('#cx_gallery_preview .cx-gallery-item').each(function(){ ids.push($(this).data('id')); });
            $('#cx_gallery').val(ids.join(','));
            reNumber();
        }

        // ドラッグ＆ドロップ並べ替え
        (function(){
            var dragEl = null;
            var preview = document.getElementById('cx_gallery_preview');
            preview.addEventListener('dragstart', function(e){
                dragEl = e.target.closest('.cx-gallery-item');
                if (!dragEl) return;
                dragEl.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
            });
            preview.addEventListener('dragover', function(e){
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                var target = e.target.closest('.cx-gallery-item');
                if (target && target !== dragEl) {
                    var rect = target.getBoundingClientRect();
                    var mid = rect.left + rect.width / 2;
                    if (e.clientX < mid) {
                        preview.insertBefore(dragEl, target);
                    } else {
                        preview.insertBefore(dragEl, target.nextSibling);
                    }
                }
            });
            preview.addEventListener('dragend', function(){
                if (dragEl) { dragEl.style.opacity = '1'; dragEl = null; }
                syncIds();
            });
            // 全アイテムに draggable 設定
            $('#cx_gallery_preview .cx-gallery-item').attr('draggable','true');
        })();

        // ギャラリー画像追加（ファイル名の番号順で自動ソート）
        $('#cx_gallery_btn').on('click', function(e){
            e.preventDefault();
            var frame = wp.media({title:'漫画ページ画像を選択',multiple:true,library:{type:'image'}});
            frame.on('select', function(){
                var selection = frame.state().get('selection');
                var newItems = [];
                selection.each(function(att){
                    newItems.push(att);
                });
                // 新規追加分をプレビューに追加（IDとファイル名を記録）
                selection.each(function(att){
                    var existIds = $('#cx_gallery').val() ? $('#cx_gallery').val().split(',').filter(Boolean) : [];
                    if (existIds.indexOf(String(att.id)) !== -1) return; // 重複スキップ
                    var url = att.attributes.sizes && att.attributes.sizes.thumbnail ? att.attributes.sizes.thumbnail.url : att.attributes.url;
                    $('#cx_gallery_preview').append('<div class="cx-gallery-item" data-id="'+att.id+'" data-filename="'+(att.attributes.filename||'')+'" draggable="true" style="position:relative;cursor:grab;user-select:none;"><div class="cx-gallery-num" style="position:absolute;top:-4px;left:-4px;background:#0073aa;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;line-height:20px;text-align:center;z-index:1;"></div><img src="'+url+'" style="width:60px;height:80px;object-fit:cover;border:2px solid #ddd;border-radius:4px;"><span class="cx-gallery-remove" data-id="'+att.id+'" style="position:absolute;top:-6px;right:-6px;background:#e00;color:#fff;border-radius:50%;width:18px;height:18px;font-size:12px;line-height:18px;text-align:center;cursor:pointer;z-index:2;">×</span></div>');
                });
                // 全体をファイル名の番号順で再ソート
                var items = $('#cx_gallery_preview .cx-gallery-item').get();
                items.sort(function(a, b){
                    var fnA = $(a).data('filename') || '';
                    var fnB = $(b).data('filename') || '';
                    var numA = parseInt((String(fnA)).match(/(\d+)/)?.[1] || '9999', 10);
                    var numB = parseInt((String(fnB)).match(/(\d+)/)?.[1] || '9999', 10);
                    return numA - numB;
                });
                $('#cx_gallery_preview').empty();
                $.each(items, function(i, el){ $('#cx_gallery_preview').append(el); });
                syncIds();
                reNumber();
            });
            frame.open();
        });
        // ===== PDFから一括取り込み（全ページをWebP分割してギャラリーへ） =====
        $('#cx_pdf_split_btn').on('click', function(e){
            e.preventDefault();
            var $btn = $(this), $st = $('#cx_pdf_split_status');
            var frame = wp.media({
                title: '分割する漫画PDFを選択',
                multiple: false,
                library: { type: 'application/pdf' },
                button: { text: 'このPDFを取り込む' }
            });
            frame.on('select', function(){
                var att = frame.state().get('selection').first();
                if (!att) return;
                var pdfId = att.id;

                $btn.prop('disabled', true);
                $('#cx_gallery_btn').prop('disabled', true);
                $st.css('color', '#555').text('PDFを解析しています…');

                // 1) ページ数を取得
                $.post(ajaxurl, {
                    action: 'cxcms_pdf_info',
                    nonce: '<?php echo esc_js( wp_create_nonce('cxcms_pdf_split') ); ?>',
                    pdf_id: pdfId
                }).done(function(res){
                    if (!res || !res.success) {
                        finish(false, (res && res.data && res.data.message) || 'PDFを読み取れませんでした');
                        return;
                    }
                    var total = parseInt(res.data.pages, 10) || 0;
                    if (total < 1) { finish(false, 'ページ数を取得できませんでした'); return; }
                    // 2) 1ページずつ変換（タイムアウト回避）
                    var page = 1, added = 0;
                    (function next(){
                        if (page > total) {
                            resort();
                            finish(true, total + 'ページを取り込みました');
                            return;
                        }
                        $st.text('変換中… ' + page + ' / ' + total + ' ページ');
                        $.post(ajaxurl, {
                            action: 'cxcms_pdf_split_page',
                            nonce: '<?php echo esc_js( wp_create_nonce('cxcms_pdf_split') ); ?>',
                            pdf_id: pdfId,
                            page: page,
                            post_id: <?php echo (int) $post->ID; ?>
                        }).done(function(r){
                            if (r && r.success && r.data && r.data.id) {
                                appendItem(r.data.id, r.data.thumb, r.data.filename);
                                added++;
                                page++;
                                next();
                            } else {
                                resort();
                                finish(false, page + 'ページ目で失敗しました（' + added + '枚は取り込み済み）: '
                                    + ((r && r.data && r.data.message) || '不明なエラー'));
                            }
                        }).fail(function(){
                            resort();
                            finish(false, page + 'ページ目で通信エラー（' + added + '枚は取り込み済み）');
                        });
                    })();
                }).fail(function(){
                    finish(false, '通信に失敗しました');
                });

                function appendItem(id, thumb, filename){
                    var exist = $('#cx_gallery').val() ? $('#cx_gallery').val().split(',').filter(Boolean) : [];
                    if (exist.indexOf(String(id)) !== -1) return;
                    $('#cx_gallery_preview').append(
                        '<div class="cx-gallery-item" data-id="'+id+'" data-filename="'+(filename||'')+'" draggable="true" '+
                        'style="position:relative;cursor:grab;user-select:none;">'+
                        '<div class="cx-gallery-num" style="position:absolute;top:-4px;left:-4px;background:#0073aa;color:#fff;'+
                        'border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;line-height:20px;text-align:center;z-index:1;"></div>'+
                        '<img src="'+thumb+'" style="width:60px;height:80px;object-fit:cover;border:2px solid #ddd;border-radius:4px;">'+
                        '<span class="cx-gallery-remove" data-id="'+id+'" style="position:absolute;top:-6px;right:-6px;background:#e00;'+
                        'color:#fff;border-radius:50%;width:18px;height:18px;font-size:12px;line-height:18px;text-align:center;cursor:pointer;z-index:2;">×</span>'+
                        '</div>'
                    );
                    syncIds();
                }
                // 既存の「画像を追加」と同じくファイル名の番号順で並べ直す
                function resort(){
                    var items = $('#cx_gallery_preview .cx-gallery-item').get();
                    items.sort(function(a, b){
                        var numA = parseInt((String($(a).data('filename')||'')).match(/(\d+)/)?.[1] || '9999', 10);
                        var numB = parseInt((String($(b).data('filename')||'')).match(/(\d+)/)?.[1] || '9999', 10);
                        return numA - numB;
                    });
                    $('#cx_gallery_preview').empty();
                    $.each(items, function(i, el){ $('#cx_gallery_preview').append(el); });
                    syncIds();
                }
                function finish(ok, msg){
                    $btn.prop('disabled', false);
                    $('#cx_gallery_btn').prop('disabled', false);
                    $st.css('color', ok ? '#046b2f' : '#b32d2e')
                       .text((ok ? '完了: ' : 'エラー: ') + msg + (ok ? '（保存するまで確定しません）' : ''));
                }
            });
            frame.open();
        });

        // ギャラリー画像削除
        $(document).on('click', '#cx_gallery_preview .cx-gallery-remove', function(e){
            e.stopPropagation();
            var removeId = $(this).data('id').toString();
            $(this).closest('.cx-gallery-item').remove();
            var ids = $('#cx_gallery').val().split(',').filter(function(id){ return id !== removeId; });
            $('#cx_gallery').val(ids.join(','));
            reNumber();
        });

        // ===== 赤ペンギャラリー =====
        function reNumberAkapen() {
            $('#cx_akapen_gallery_preview .cx-gallery-num').each(function(i){ $(this).text(i+1); });
        }
        function syncAkapenIds() {
            var ids = [];
            $('#cx_akapen_gallery_preview .cx-akapen-item').each(function(){ ids.push($(this).data('id')); });
            $('#cx_akapen_gallery').val(ids.join(','));
            reNumberAkapen();
        }
        (function(){
            var dragEl = null;
            var preview = document.getElementById('cx_akapen_gallery_preview');
            preview.addEventListener('dragstart', function(e){
                dragEl = e.target.closest('.cx-akapen-item');
                if (!dragEl) return;
                dragEl.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
            });
            preview.addEventListener('dragover', function(e){
                e.preventDefault();
                var target = e.target.closest('.cx-akapen-item');
                if (target && target !== dragEl) {
                    var rect = target.getBoundingClientRect();
                    var mid = rect.left + rect.width / 2;
                    if (e.clientX < mid) preview.insertBefore(dragEl, target);
                    else preview.insertBefore(dragEl, target.nextSibling);
                }
            });
            preview.addEventListener('dragend', function(){ if(dragEl){dragEl.style.opacity='1';dragEl=null;} syncAkapenIds(); });
        })();
        $('#cx_akapen_gallery_btn').on('click', function(e){
            e.preventDefault();
            var frame = wp.media({title:'赤ペン画像を選択',multiple:true,library:{type:'image'}});
            frame.on('select', function(){
                var selection = frame.state().get('selection');
                var newItems = [];
                selection.each(function(att){ newItems.push(att); });
                newItems.sort(function(a,b){
                    var numA = parseInt((a.attributes.filename||'').match(/(\d+)/)?.[1]||'0',10);
                    var numB = parseInt((b.attributes.filename||'').match(/(\d+)/)?.[1]||'0',10);
                    return numA - numB;
                });
                var ids = $('#cx_akapen_gallery').val() ? $('#cx_akapen_gallery').val().split(',').filter(Boolean) : [];
                newItems.forEach(function(att){
                    ids.push(att.id);
                    var url = att.attributes.sizes && att.attributes.sizes.thumbnail ? att.attributes.sizes.thumbnail.url : att.attributes.url;
                    $('#cx_akapen_gallery_preview').append('<div class="cx-gallery-item cx-akapen-item" data-id="'+att.id+'" draggable="true" style="position:relative;cursor:grab;user-select:none;"><div class="cx-gallery-num" style="position:absolute;top:-4px;left:-4px;background:#e53935;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;line-height:20px;text-align:center;z-index:1;"></div><img src="'+url+'" style="width:60px;height:80px;object-fit:cover;border:2px solid #e53935;border-radius:4px;"><span class="cx-gallery-remove cx-akapen-remove" data-id="'+att.id+'" style="position:absolute;top:-6px;right:-6px;background:#e00;color:#fff;border-radius:50%;width:18px;height:18px;font-size:12px;line-height:18px;text-align:center;cursor:pointer;z-index:2;">×</span></div>');
                });
                $('#cx_akapen_gallery').val(ids.join(','));
                reNumberAkapen();
            });
            frame.open();
        });
        $(document).on('click', '.cx-akapen-remove', function(e){
            e.stopPropagation();
            var removeId = $(this).data('id').toString();
            $(this).closest('.cx-akapen-item').remove();
            var ids = $('#cx_akapen_gallery').val().split(',').filter(function(id){ return id !== removeId; });
            $('#cx_akapen_gallery').val(ids.join(','));
            reNumberAkapen();
        });

        // ===== ネームギャラリー =====
        function reNumberName() {
            $('#cx_name_gallery_preview .cx-gallery-num').each(function(i){ $(this).text(i+1); });
        }
        function syncNameIds() {
            var ids = [];
            $('#cx_name_gallery_preview .cx-name-item').each(function(){ ids.push($(this).data('id')); });
            $('#cx_name_gallery').val(ids.join(','));
            reNumberName();
        }
        (function(){
            var dragEl = null;
            var preview = document.getElementById('cx_name_gallery_preview');
            preview.addEventListener('dragstart', function(e){
                dragEl = e.target.closest('.cx-name-item');
                if (!dragEl) return;
                dragEl.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
            });
            preview.addEventListener('dragover', function(e){
                e.preventDefault();
                var target = e.target.closest('.cx-name-item');
                if (target && target !== dragEl) {
                    var rect = target.getBoundingClientRect();
                    var mid = rect.left + rect.width / 2;
                    if (e.clientX < mid) preview.insertBefore(dragEl, target);
                    else preview.insertBefore(dragEl, target.nextSibling);
                }
            });
            preview.addEventListener('dragend', function(){ if(dragEl){dragEl.style.opacity='1';dragEl=null;} syncNameIds(); });
        })();
        $('#cx_name_gallery_btn').on('click', function(e){
            e.preventDefault();
            var frame = wp.media({title:'ネーム画像を選択',multiple:true,library:{type:'image'}});
            frame.on('select', function(){
                var selection = frame.state().get('selection');
                var newItems = [];
                selection.each(function(att){ newItems.push(att); });
                newItems.sort(function(a,b){
                    var numA = parseInt((a.attributes.filename||'').match(/(\d+)/)?.[1]||'0',10);
                    var numB = parseInt((b.attributes.filename||'').match(/(\d+)/)?.[1]||'0',10);
                    return numA - numB;
                });
                var ids = $('#cx_name_gallery').val() ? $('#cx_name_gallery').val().split(',').filter(Boolean) : [];
                newItems.forEach(function(att){
                    ids.push(att.id);
                    var url = att.attributes.sizes && att.attributes.sizes.thumbnail ? att.attributes.sizes.thumbnail.url : att.attributes.url;
                    $('#cx_name_gallery_preview').append('<div class="cx-gallery-item cx-name-item" data-id="'+att.id+'" draggable="true" style="position:relative;cursor:grab;user-select:none;"><div class="cx-gallery-num" style="position:absolute;top:-4px;left:-4px;background:#ff9800;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;line-height:20px;text-align:center;z-index:1;"></div><img src="'+url+'" style="width:60px;height:80px;object-fit:cover;border:2px solid #ff9800;border-radius:4px;"><span class="cx-gallery-remove cx-name-remove" data-id="'+att.id+'" style="position:absolute;top:-6px;right:-6px;background:#e00;color:#fff;border-radius:50%;width:18px;height:18px;font-size:12px;line-height:18px;text-align:center;cursor:pointer;z-index:2;">×</span></div>');
                });
                $('#cx_name_gallery').val(ids.join(','));
                reNumberName();
            });
            frame.open();
        });
        $(document).on('click', '.cx-name-remove', function(e){
            e.stopPropagation();
            var removeId = $(this).data('id').toString();
            $(this).closest('.cx-name-item').remove();
            var ids = $('#cx_name_gallery').val().split(',').filter(function(id){ return id !== removeId; });
            $('#cx_name_gallery').val(ids.join(','));
            reNumberName();
        });
    });
    </script>
    <?php
}

/* ── ニュース メタボックス HTML ── */
function cxcms_news_meta_html( $post ) {
    wp_nonce_field( 'cxcms_news_save', 'cxcms_news_nonce' );
    $m = fn($k) => get_post_meta( $post->ID, $k, true );
    ?>
    <style>.cx-field{margin:10px 0}.cx-field label{display:block;font-weight:700;margin-bottom:4px}.cx-field input,.cx-field textarea{width:100%;padding:6px 8px;box-sizing:border-box}.cx-field textarea{min-height:200px;font-family:inherit}.cx-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cx-hint{color:#666;font-size:12px;margin-top:2px}</style>
    <div class="cx-row">
        <div class="cx-field">
            <label>タイトル（英語）</label>
            <input name="cx_news_title_en" value="<?php echo esc_attr($m('cx_news_title_en')); ?>">
        </div>
        <div class="cx-field">
            <label>リンクURL（任意）</label>
            <input name="cx_news_url" value="<?php echo esc_attr($m('cx_news_url')); ?>" placeholder="https://...">
        </div>
    </div>
    <div class="cx-field">
        <label>本文（英語）</label>
        <textarea name="cx_news_content_en" placeholder="Leave blank to show Japanese content even in English mode."><?php echo esc_textarea($m('cx_news_content_en')); ?></textarea>
        <div class="cx-hint">HTMLタグも使用可。空欄の場合、英語表示時も日本語本文が表示されます。</div>
    </div>
    <div class="cx-field">
        <label>表示先サイト</label>
        <?php cxcms_show_site_checkboxes_html( 'cx_news_show_site', $m('cx_news_show_site') ); ?>
        <div class="cx-hint">このニュースを表示するサイトにチェック（複数可）。チェックなし＝どこにも表示しない</div>
    </div>
    <?php
    /* アイキャッチURL */
    $thumb_id_for_preview = get_post_thumbnail_id( $post->ID );
    $thumb_url_for_preview = '';
    if ( $thumb_id_for_preview ) {
        $_img = wp_get_attachment_image_src( $thumb_id_for_preview, 'large' );
        if ( $_img ) $thumb_url_for_preview = $_img[0];
    }

    /* 旧フィールド（フォールバック用） */
    $old_mode = $m('cx_news_image_mode') ?: 'contain';
    $old_x = floatval($m('cx_news_image_crop_x'));
    $old_y = floatval($m('cx_news_image_crop_y'));
    $old_w = floatval($m('cx_news_image_crop_w'));
    $old_h = floatval($m('cx_news_image_crop_h'));
    if ($old_w <= 0 || $old_h <= 0) { $old_x = 0; $old_y = 0; $old_w = 100; $old_h = 100; }

    /* ヘルパー: top/detail 用の値（個別→旧→デフォルトの順でフォールバック） */
    $_get = function($k, $fb) use ($m) {
        $v = $m($k);
        return ($v !== '' && $v !== null) ? $v : $fb;
    };

    $top_mode = $_get('cx_news_image_mode_top', $old_mode);
    $top_x = floatval($_get('cx_news_image_crop_x_top', $old_x));
    $top_y = floatval($_get('cx_news_image_crop_y_top', $old_y));
    $top_w = floatval($_get('cx_news_image_crop_w_top', $old_w));
    $top_h = floatval($_get('cx_news_image_crop_h_top', $old_h));
    if ($top_w <= 0 || $top_h <= 0) { $top_x = 0; $top_y = 0; $top_w = 100; $top_h = 100; }

    $detail_mode = $_get('cx_news_image_mode_detail', $old_mode);
    $detail_x = floatval($_get('cx_news_image_crop_x_detail', $old_x));
    $detail_y = floatval($_get('cx_news_image_crop_y_detail', $old_y));
    $detail_w = floatval($_get('cx_news_image_crop_w_detail', $old_w));
    $detail_h = floatval($_get('cx_news_image_crop_h_detail', $old_h));
    if ($detail_w <= 0 || $detail_h <= 0) { $detail_x = 0; $detail_y = 0; $detail_w = 100; $detail_h = 100; }

    /* 1ブロック描画関数 */
    $render_block = function($key, $title, $desc, $mode, $x, $y, $w, $h) use ($thumb_url_for_preview) {
        $suffix = ucfirst($key); // 'top' → 'Top'
        $name_prefix = 'cx_news_image';
        ?>
        <div class="cx-img-block" data-target="<?php echo esc_attr($key); ?>">
            <div class="cx-img-block-head">
                <span class="cx-img-block-name"><?php echo esc_html($title); ?></span>
                <span class="cx-img-block-desc"><?php echo esc_html($desc); ?></span>
            </div>

            <div class="cx-img-mode-tabs">
                <label class="cx-img-mode-tab <?php echo $mode === 'contain' ? 'active' : ''; ?>">
                    <input type="radio" name="<?php echo esc_attr($name_prefix . '_mode_' . $key); ?>" value="contain" <?php checked($mode, 'contain'); ?>>
                    <span class="cx-img-mode-tab-inner">
                        <span class="cx-img-mode-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                        </span>
                        <span class="cx-img-mode-text">
                            <strong>全体表示</strong>
                            <small>余白なしで全部見せる</small>
                        </span>
                    </span>
                </label>
                <label class="cx-img-mode-tab <?php echo $mode === 'crop' ? 'active' : ''; ?>">
                    <input type="radio" name="<?php echo esc_attr($name_prefix . '_mode_' . $key); ?>" value="crop" <?php checked($mode, 'crop'); ?>>
                    <span class="cx-img-mode-tab-inner">
                        <span class="cx-img-mode-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
                        </span>
                        <span class="cx-img-mode-text">
                            <strong>トリミング</strong>
                            <small>使う範囲を選ぶ</small>
                        </span>
                    </span>
                </label>
            </div>

            <?php if ($thumb_url_for_preview): ?>
            <div class="cx-cropper-wrap" id="<?php echo 'cxCropperWrap' . $suffix; ?>">
                <img id="<?php echo 'cxCropperImg' . $suffix; ?>" src="<?php echo esc_url($thumb_url_for_preview); ?>" alt="">
            </div>
            <?php else: ?>
            <div class="cx-empty-msg">アイキャッチ画像を設定すると操作できます</div>
            <?php endif; ?>

            <div class="cx-img-preview-wrap">
                <div class="cx-img-preview-label">表示プレビュー</div>
                <div class="cx-img-preview-container" id="<?php echo 'cxPreview' . $suffix; ?>"></div>
            </div>

            <input type="hidden" name="<?php echo esc_attr($name_prefix . '_crop_x_' . $key); ?>" id="<?php echo 'cxCropX' . $suffix; ?>" value="<?php echo esc_attr($x); ?>">
            <input type="hidden" name="<?php echo esc_attr($name_prefix . '_crop_y_' . $key); ?>" id="<?php echo 'cxCropY' . $suffix; ?>" value="<?php echo esc_attr($y); ?>">
            <input type="hidden" name="<?php echo esc_attr($name_prefix . '_crop_w_' . $key); ?>" id="<?php echo 'cxCropW' . $suffix; ?>" value="<?php echo esc_attr($w); ?>">
            <input type="hidden" name="<?php echo esc_attr($name_prefix . '_crop_h_' . $key); ?>" id="<?php echo 'cxCropH' . $suffix; ?>" value="<?php echo esc_attr($h); ?>">
        </div>
        <?php
    };
    ?>

    <div class="cx-field">
        <details class="cx-img-toggle" id="cxImgToggle">
            <summary class="cx-img-toggle-summary">
                <span class="cx-img-toggle-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="M21 15l-5-5L5 21"/>
                    </svg>
                </span>
                <span class="cx-img-toggle-label">画像表示の調節</span>
                <span class="cx-img-toggle-sub">ホーム表示・詳細ページ表示の見え方を設定</span>
                <span class="cx-img-toggle-chev" aria-hidden="true">▼</span>
            </summary>
            <div class="cx-img-toggle-body">
                <div class="cx-img-blocks">
                    <?php $render_block('top',    'ホーム・一覧表示',  'トップページや news 一覧で表示される画像', $top_mode,    $top_x,    $top_y,    $top_w,    $top_h); ?>
                    <?php $render_block('detail', '記事詳細ページ',    'クリックして開いた詳細ページの hero 画像',  $detail_mode, $detail_x, $detail_y, $detail_w, $detail_h); ?>
                </div>
                <div class="cx-hint">
                    ホーム用と詳細ページ用は別々に設定できます。同じ設定でいい場合はどちらか片方だけ調整すれば、もう一方も同じ初期値で表示されます。
                </div>
            </div>
        </details>
    </div>

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js"></script>

    <style>
        /* 折りたたみ「画像表示の調節」 */
        .cx-img-toggle{border:1px solid #ddd;border-radius:8px;background:#fff;overflow:hidden;margin-top:8px}
        .cx-img-toggle-summary{display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer;background:#f7f7f7;font-weight:600;color:#1d2327;list-style:none;user-select:none;transition:background 0.15s}
        .cx-img-toggle-summary::-webkit-details-marker{display:none}
        .cx-img-toggle-summary:hover{background:#eef0f2}
        .cx-img-toggle-icon{display:flex;color:#0073aa;flex-shrink:0}
        .cx-img-toggle-label{font-size:13px;font-weight:700;color:#1d2327}
        .cx-img-toggle-sub{flex:1;font-size:11px;font-weight:400;color:#888;margin-left:4px}
        .cx-img-toggle-chev{font-size:9px;color:#888;transition:transform 0.2s;flex-shrink:0}
        .cx-img-toggle[open] > .cx-img-toggle-summary{background:#e7f3fa;color:#0073aa;border-bottom:1px solid #c8d9e2}
        .cx-img-toggle[open] > .cx-img-toggle-summary .cx-img-toggle-chev{transform:rotate(180deg);color:#0073aa}
        .cx-img-toggle-body{padding:16px;background:#fafafa}

        .cx-img-blocks{display:flex;flex-direction:column;gap:18px}
        .cx-img-block{background:#fff;border:1px solid #ddd;border-radius:8px;padding:14px;max-width:100%;box-sizing:border-box}
        .cx-img-block-head{margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #eee}
        .cx-img-block-name{display:block;font-weight:700;font-size:13px;color:#1d2327;margin-bottom:3px}
        .cx-img-block-desc{display:block;font-size:11px;color:#888;line-height:1.5}

        /* セグメントコントロール */
        .cx-img-mode-tabs{display:flex;background:#f0f0f1;border-radius:6px;padding:3px;margin-bottom:12px;gap:2px}
        .cx-img-mode-tab{flex:1;cursor:pointer;border-radius:4px;transition:all 0.15s;background:transparent;color:#3c434a}
        .cx-img-mode-tab input{display:none}
        .cx-img-mode-tab-inner{display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 10px}
        .cx-img-mode-tab:hover:not(.active){background:rgba(255,255,255,0.6)}
        .cx-img-mode-tab.active{background:#fff;color:#0073aa;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
        .cx-img-mode-icon{display:flex;align-items:center;flex-shrink:0;color:inherit}
        .cx-img-mode-text{display:flex;flex-direction:column;text-align:left;line-height:1.25}
        .cx-img-mode-text strong{font-size:12px;font-weight:700;color:inherit}
        .cx-img-mode-text small{font-size:10px;opacity:0.75;color:inherit}

        .cx-cropper-wrap{max-width:100%;margin-bottom:12px;background:#fff;border:1px solid #ddd;border-radius:4px;overflow:hidden}
        .cx-cropper-wrap img{max-width:100%;display:block}
        .cx-cropper-wrap[hidden]{display:none}

        .cx-empty-msg{padding:24px 12px;background:#f9f9f9;border:1px dashed #ccc;text-align:center;color:#999;font-size:12px;border-radius:4px;margin-bottom:12px}

        .cx-img-preview-wrap{background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:10px}
        .cx-img-preview-label{font-size:10px;color:#888;font-weight:600;margin-bottom:6px;letter-spacing:0.05em;text-transform:uppercase}
        .cx-img-preview-container{background:#fff;border:1px dashed #ccc;overflow:hidden;width:100%;max-width:280px;min-height:60px;border-radius:3px}

        .cx-hint{color:#666;font-size:11px;margin-top:10px;line-height:1.7;padding:8px 10px;background:#fffbf0;border-left:3px solid #f0b849;border-radius:3px}
        /* 2ブロックは常に縦並び（サイドバー配置でも潰れないため） */
    </style>

    <script>
    (function(){
        function setupBlock(suffix, lowercaseKey) {
            var img = document.getElementById('cxCropperImg' + suffix);
            var wrap = document.getElementById('cxCropperWrap' + suffix);
            var preview = document.getElementById('cxPreview' + suffix);
            var modeRadios = document.querySelectorAll('input[name="cx_news_image_mode_' + lowercaseKey + '"]');
            var cropX = document.getElementById('cxCropX' + suffix);
            var cropY = document.getElementById('cxCropY' + suffix);
            var cropW = document.getElementById('cxCropW' + suffix);
            var cropH = document.getElementById('cxCropH' + suffix);
            var cropper = null;

            function getMode() {
                for (var i = 0; i < modeRadios.length; i++) {
                    if (modeRadios[i].checked) return modeRadios[i].value;
                }
                return 'contain';
            }

            function clearChildren(el) { while (el.firstChild) el.removeChild(el.firstChild); }

            function updateActiveTab() {
                for (var i = 0; i < modeRadios.length; i++) {
                    var label = modeRadios[i].closest('label');
                    if (label) label.classList.toggle('active', modeRadios[i].checked);
                }
            }

            function updatePreview() {
                if (!preview) return;
                var mode = getMode();
                var src = img ? img.src : '';
                var x = parseFloat(cropX.value) || 0;
                var y = parseFloat(cropY.value) || 0;
                var w = parseFloat(cropW.value) || 100;
                var h = parseFloat(cropH.value) || 100;
                clearChildren(preview);
                if (!src) return;
                if (mode === 'contain') {
                    var im = document.createElement('img');
                    im.src = src;
                    im.style.cssText = 'width:100%;height:auto;display:block;';
                    preview.appendChild(im);
                } else {
                    var div = document.createElement('div');
                    var bgPosX = (100 - w > 0) ? (x/(100-w)*100).toFixed(2) + '%' : '50%';
                    var bgPosY = (100 - h > 0) ? (y/(100-h)*100).toFixed(2) + '%' : '50%';
                    div.style.cssText =
                        'width:100%;aspect-ratio:' + (w/h).toFixed(4) + ';' +
                        'background-image:url(' + src + ');' +
                        'background-size:' + (10000/w).toFixed(2) + '% auto;' +
                        'background-position:' + bgPosX + ' ' + bgPosY + ';' +
                        'background-repeat:no-repeat;';
                    preview.appendChild(div);
                }
            }

            function initCropper() {
                if (cropper || !img || typeof Cropper === 'undefined') return;
                cropper = new Cropper(img, {
                    viewMode: 1, autoCrop: true, zoomable: false, movable: false,
                    scalable: false, rotatable: false, background: false, checkOrientation: false,
                    ready: function() {
                        var data = cropper.getImageData();
                        var nx = (parseFloat(cropX.value) || 0) / 100 * data.naturalWidth;
                        var ny = (parseFloat(cropY.value) || 0) / 100 * data.naturalHeight;
                        var nw = (parseFloat(cropW.value) || 100) / 100 * data.naturalWidth;
                        var nh = (parseFloat(cropH.value) || 100) / 100 * data.naturalHeight;
                        cropper.setData({ x: nx, y: ny, width: nw, height: nh });
                    },
                    crop: function() {
                        var data = cropper.getImageData();
                        var d = cropper.getData(true);
                        if (!data.naturalWidth) return;
                        cropX.value = (d.x / data.naturalWidth * 100).toFixed(2);
                        cropY.value = (d.y / data.naturalHeight * 100).toFixed(2);
                        cropW.value = (d.width / data.naturalWidth * 100).toFixed(2);
                        cropH.value = (d.height / data.naturalHeight * 100).toFixed(2);
                        updatePreview();
                    }
                });
            }

            function destroyCropper() {
                if (cropper) { cropper.destroy(); cropper = null; }
            }

            function onModeChange() {
                var mode = getMode();
                updateActiveTab();
                if (!wrap) { updatePreview(); return; }
                if (mode === 'crop') {
                    wrap.hidden = false;
                    initCropper();
                } else {
                    wrap.hidden = true;
                    destroyCropper();
                }
                updatePreview();
            }

            for (var i = 0; i < modeRadios.length; i++) {
                modeRadios[i].addEventListener('change', onModeChange);
            }

            if (img) {
                if (img.complete && img.naturalWidth) {
                    onModeChange();
                } else {
                    img.addEventListener('load', onModeChange);
                }
            } else {
                onModeChange();
            }
        }

        var initialized = false;
        function ensureInit() {
            if (initialized) return;
            initialized = true;
            setupBlock('Top', 'top');
            setupBlock('Detail', 'detail');
        }

        var details = document.getElementById('cxImgToggle');
        if (details) {
            if (details.open) ensureInit();
            details.addEventListener('toggle', function() {
                if (details.open) ensureInit();
            });
        } else {
            ensureInit();
        }
    })();
    </script>
    <?php
}

/* ── 赤ペン・ネーム メタボックス HTML ── */
function cxcms_preproduction_meta_html( $post ) {
    wp_nonce_field( 'cxcms_preprod_save', 'cxcms_preprod_nonce' );
    $m = function( $k ) use ( $post ) { return get_post_meta( $post->ID, $k, true ); };
    $type = $m('cx_preprod_type') ?: 'akapen';
    $related = $m('cx_preprod_related_work') ?: '';
    $order = $m('cx_preprod_sort_order') ?: '10';

    // 関連作品のドロップダウン用
    $works = get_posts(['post_type'=>'manga_work','posts_per_page'=>200,'post_status'=>'publish','orderby'=>'title','order'=>'ASC']);
    ?>
    <style>
        .cx-field{margin:10px 0}.cx-field label{display:block;font-weight:700;margin-bottom:4px}
        .cx-field input,.cx-field textarea,.cx-field select{width:100%;padding:6px 8px}
        .cx-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .cx-hint{color:#666;font-size:12px;margin-top:2px}
    </style>
    <div class="cx-row">
        <div class="cx-field">
            <label>タイプ</label>
            <select name="cx_preprod_type">
                <option value="akapen" <?php selected($type,'akapen'); ?>>赤ペン（修正指示）</option>
                <option value="name" <?php selected($type,'name'); ?>>ネーム（下描き）</option>
            </select>
        </div>
        <div class="cx-field">
            <label>関連する漫画事例</label>
            <select name="cx_preprod_related_work">
                <option value="">— 選択なし —</option>
                <?php foreach ($works as $w) :
                    $wid = get_post_meta($w->ID, 'cx_work_id', true) ?: sanitize_title($w->post_title);
                ?>
                <option value="<?php echo esc_attr($wid); ?>" <?php selected($related, $wid); ?>><?php echo esc_html($w->post_title); ?> (<?php echo esc_html($wid); ?>)</option>
                <?php endforeach; ?>
            </select>
            <div class="cx-hint">この赤ペン/ネームがどの漫画事例に対応するか</div>
        </div>
    </div>
    <div class="cx-field">
        <label>表示順</label>
        <input type="number" name="cx_preprod_sort_order" value="<?php echo esc_attr($order); ?>" style="width:80px">
    </div>
    <div class="cx-field">
        <label>画像ギャラリー — ドラッグで並べ替え可能</label>
        <input type="hidden" name="cx_preprod_gallery" id="cx_preprod_gallery" value="<?php echo esc_attr($m('cx_preprod_gallery')); ?>">
        <div id="cx_preprod_gallery_preview" style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;">
        <?php
        $gallery_ids = $m('cx_preprod_gallery');
        if ($gallery_ids) {
            $idx = 1;
            foreach (array_filter(array_map('trim', explode(',', $gallery_ids))) as $att_id) {
                $img = wp_get_attachment_image_src((int)$att_id, 'thumbnail');
                if ($img) {
                    $border_color = ($type === 'akapen') ? '#e53935' : '#ff9800';
                    echo '<div class="cx-gallery-item cx-preprod-item" data-id="'.esc_attr($att_id).'" draggable="true" style="position:relative;cursor:grab;user-select:none;">'
                        .'<div style="position:absolute;top:-4px;left:-4px;background:'.$border_color.';color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;line-height:20px;text-align:center;z-index:1;" class="cx-gallery-num">'.$idx.'</div>'
                        .'<img src="'.esc_url($img[0]).'" style="width:60px;height:80px;object-fit:cover;border:2px solid '.$border_color.';border-radius:4px;">'
                        .'<span class="cx-gallery-remove cx-preprod-remove" data-id="'.esc_attr($att_id).'" style="position:absolute;top:-6px;right:-6px;background:#e00;color:#fff;border-radius:50%;width:18px;height:18px;font-size:12px;line-height:18px;text-align:center;cursor:pointer;z-index:2;">×</span>'
                        .'</div>';
                    $idx++;
                }
            }
        }
        ?>
        </div>
        <button type="button" id="cx_preprod_gallery_btn" class="button">画像を追加</button>
        <div class="cx-hint">赤ペンまたはネームの画像をアップロード。ファイル名の番号順で自動ソートされます。</div>
    </div>
    <script>
    jQuery(function($){
        function reNumberPreprod() {
            $('#cx_preprod_gallery_preview .cx-gallery-num').each(function(i){ $(this).text(i+1); });
        }
        function syncPreprodIds() {
            var ids = [];
            $('#cx_preprod_gallery_preview .cx-preprod-item').each(function(){ ids.push($(this).data('id')); });
            $('#cx_preprod_gallery').val(ids.join(','));
            reNumberPreprod();
        }
        (function(){
            var dragEl = null;
            var preview = document.getElementById('cx_preprod_gallery_preview');
            if (!preview) return;
            preview.addEventListener('dragstart', function(e){
                dragEl = e.target.closest('.cx-preprod-item');
                if (!dragEl) return;
                dragEl.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
            });
            preview.addEventListener('dragover', function(e){
                e.preventDefault();
                var target = e.target.closest('.cx-preprod-item');
                if (target && target !== dragEl) {
                    var rect = target.getBoundingClientRect();
                    var mid = rect.left + rect.width / 2;
                    if (e.clientX < mid) preview.insertBefore(dragEl, target);
                    else preview.insertBefore(dragEl, target.nextSibling);
                }
            });
            preview.addEventListener('dragend', function(){ if(dragEl){dragEl.style.opacity='1';dragEl=null;} syncPreprodIds(); });
        })();
        $('#cx_preprod_gallery_btn').on('click', function(e){
            e.preventDefault();
            var frame = wp.media({title:'画像を選択',multiple:true,library:{type:'image'}});
            frame.on('select', function(){
                var selection = frame.state().get('selection');
                var newItems = [];
                selection.each(function(att){ newItems.push(att); });
                newItems.sort(function(a,b){
                    var numA = parseInt((a.attributes.filename||'').match(/(\d+)/)?.[1]||'0',10);
                    var numB = parseInt((b.attributes.filename||'').match(/(\d+)/)?.[1]||'0',10);
                    return numA - numB;
                });
                var borderColor = $('select[name=cx_preprod_type]').val() === 'akapen' ? '#e53935' : '#ff9800';
                var ids = $('#cx_preprod_gallery').val() ? $('#cx_preprod_gallery').val().split(',').filter(Boolean) : [];
                newItems.forEach(function(att){
                    ids.push(att.id);
                    var url = att.attributes.sizes && att.attributes.sizes.thumbnail ? att.attributes.sizes.thumbnail.url : att.attributes.url;
                    $('#cx_preprod_gallery_preview').append('<div class="cx-gallery-item cx-preprod-item" data-id="'+att.id+'" draggable="true" style="position:relative;cursor:grab;user-select:none;"><div class="cx-gallery-num" style="position:absolute;top:-4px;left:-4px;background:'+borderColor+';color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;line-height:20px;text-align:center;z-index:1;"></div><img src="'+url+'" style="width:60px;height:80px;object-fit:cover;border:2px solid '+borderColor+';border-radius:4px;"><span class="cx-gallery-remove cx-preprod-remove" data-id="'+att.id+'" style="position:absolute;top:-6px;right:-6px;background:#e00;color:#fff;border-radius:50%;width:18px;height:18px;font-size:12px;line-height:18px;text-align:center;cursor:pointer;z-index:2;">×</span></div>');
                });
                $('#cx_preprod_gallery').val(ids.join(','));
                reNumberPreprod();
            });
            frame.open();
        });
        $(document).on('click', '.cx-preprod-remove', function(e){
            e.stopPropagation();
            var removeId = $(this).data('id').toString();
            $(this).closest('.cx-preprod-item').remove();
            var ids = $('#cx_preprod_gallery').val().split(',').filter(function(id){ return id !== removeId; });
            $('#cx_preprod_gallery').val(ids.join(','));
            reNumberPreprod();
        });
    });
    </script>
    <?php
}

/* ── お客様の声 メタボックス HTML ── */
function cxcms_testimonial_meta_html( $post ) {
    wp_nonce_field( 'cxcms_testimonial_save', 'cxcms_testimonial_nonce' );
    $m = fn($k) => get_post_meta( $post->ID, $k, true );
    ?>
    <style>.cx-field{margin:10px 0}.cx-field label{display:block;font-weight:700;margin-bottom:4px}.cx-field input,.cx-field textarea,.cx-field select{width:100%;padding:6px 8px}.cx-hint{color:#666;font-size:12px;margin-top:2px}.cx-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}</style>
    <p class="cx-hint">※ 表紙画像は「アイキャッチ画像」で設定してください。詳細ページの本文は上の「エディタ」で編集してください。</p>
    <div class="cx-row">
        <div class="cx-field">
            <label>見出しテキスト</label>
            <input name="cx_testimonial_heading" value="<?php echo esc_attr($m('cx_testimonial_heading')); ?>" placeholder="例: 採用応募数が2倍に増加">
            <div class="cx-hint">カード上に表示される見出し</div>
        </div>
        <div class="cx-field">
            <label>見出し（英語）</label>
            <input name="cx_testimonial_heading_en" value="<?php echo esc_attr($m('cx_testimonial_heading_en')); ?>" placeholder="例: Application numbers doubled">
        </div>
    </div>
    <div class="cx-field">
        <label>カード説明文</label>
        <textarea name="cx_testimonial_excerpt" rows="3" placeholder="カードに表示される短い説明文"><?php echo esc_textarea($m('cx_testimonial_excerpt')); ?></textarea>
    </div>
    <div class="cx-field">
        <label>カード説明文（英語）</label>
        <textarea name="cx_testimonial_excerpt_en" rows="3"><?php echo esc_textarea($m('cx_testimonial_excerpt_en')); ?></textarea>
    </div>
    <div class="cx-row">
        <div class="cx-field">
            <label>表紙画像の位置</label>
            <select name="cx_testimonial_img_position">
                <option value="center" <?php selected($m('cx_testimonial_img_position'), 'center'); ?>>中央</option>
                <option value="top" <?php selected($m('cx_testimonial_img_position'), 'top'); ?>>上</option>
                <option value="bottom" <?php selected($m('cx_testimonial_img_position'), 'bottom'); ?>>下</option>
                <option value="left" <?php selected($m('cx_testimonial_img_position'), 'left'); ?>>左</option>
                <option value="right" <?php selected($m('cx_testimonial_img_position'), 'right'); ?>>右</option>
            </select>
            <div class="cx-hint">表紙のどの部分を表示するか（object-position）</div>
        </div>
        <div class="cx-field">
            <label>表示順（小さい値が先）</label>
            <input type="number" name="cx_testimonial_order" value="<?php echo esc_attr($m('cx_testimonial_order') ?: '10'); ?>">
        </div>
    </div>
    <div class="cx-field">
        <label>表示先サイト</label>
        <select name="cx_testimonial_show_site">
            <option value="both" <?php selected($m('cx_testimonial_show_site'), 'both'); ?>>両方（BizManga + ContentsX）</option>
            <option value="bizmanga" <?php selected($m('cx_testimonial_show_site'), 'bizmanga'); ?>>BizMangaのみ</option>
            <option value="contentsx" <?php selected($m('cx_testimonial_show_site'), 'contentsx'); ?>>ContentsXのみ</option>
        </select>
    </div>
    <?php
}

/* ── お客様の声 メタ保存 ── */
add_action( 'save_post_cx_testimonial', 'cxcms_save_testimonial_meta' );
function cxcms_save_testimonial_meta( $post_id ) {
    if ( ! isset($_POST['cxcms_testimonial_nonce']) || ! wp_verify_nonce($_POST['cxcms_testimonial_nonce'], 'cxcms_testimonial_save') ) return;
    if ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) return;
    $fields = ['cx_testimonial_heading','cx_testimonial_heading_en','cx_testimonial_excerpt','cx_testimonial_excerpt_en','cx_testimonial_img_position','cx_testimonial_order','cx_testimonial_show_site'];
    foreach ( $fields as $f ) {
        if ( isset($_POST[$f]) ) update_post_meta( $post_id, $f, sanitize_text_field($_POST[$f]) );
    }
}

/* ── メタ保存 ── */
add_action( 'save_post_manga_work', 'cxcms_save_manga_meta' );
function cxcms_save_manga_meta( $post_id ) {
    if ( ! isset($_POST['cxcms_manga_nonce']) || ! wp_verify_nonce($_POST['cxcms_manga_nonce'], 'cxcms_manga_save') ) return;
    if ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) return;
    $fields = ['cx_work_id','cx_title_en','cx_subtitle_ja','cx_subtitle_en','cx_pages','cx_client','cx_client_url','cx_cta_label_ja','cx_cta_label_en','cx_spec_pages','cx_spec_period','cx_media','cx_point','cx_comment','cx_sort_order','cx_show_hero','cx_show_hero_site','cx_hero_order_bm','cx_hero_order_cx','cx_is_new','cx_added_date','cx_gallery','cx_akapen_gallery','cx_name_gallery','cx_show_library','cx_show_site','cx_show_gallery_bizmanga','cx_show_new_contentsx','cx_private'];
    foreach ( $fields as $f ) {
        if ( isset($_POST[$f]) ) update_post_meta( $post_id, $f, sanitize_text_field($_POST[$f]) );
    }
    /* チェックボックス: 未チェック時は POST に来ないので '0' を明示保存 */
    update_post_meta( $post_id, 'cx_cta_enabled', isset($_POST['cx_cta_enabled']) ? '1' : '0' );
    update_post_meta( $post_id, 'cx_vertical_read', isset($_POST['cx_vertical_read']) ? '1' : '0' );
    /* Hero順番の重複解消: BM・CX それぞれ独立してシフト */
    foreach ( ['bm' => 'cx_hero_order_bm', 'cx' => 'cx_hero_order_cx'] as $site => $key ) {
        if ( isset($_POST[$key]) && $_POST[$key] !== '' ) {
            $new_order = (int) $_POST[$key];
            if ( $new_order > 0 ) {
                cxcms_shift_hero_order( $post_id, $new_order, $key );
            }
        }
    }
}

/* ── Hero順番: 重複時に既存作品を1つずつ後ろにずらす ──
   $meta_key は cx_hero_order_bm または cx_hero_order_cx（サイトごとに独立）
   new_order以上の他作品を大きい順に+1シフト。new_orderにちょうど誰かいれば衝突解消される */
function cxcms_shift_hero_order( $current_post_id, $new_order, $meta_key ) {
    /* まず同じ番号が既に使われているか確認（衝突がなければシフト不要） */
    $has_collision = get_posts([
        'post_type'      => 'manga_work',
        'posts_per_page' => 1,
        'post_status'    => 'any',
        'post__not_in'   => [ $current_post_id ],
        'meta_query'     => [[
            'key'     => $meta_key,
            'value'   => $new_order,
            'compare' => '=',
            'type'    => 'NUMERIC',
        ]],
        'fields'         => 'ids',
    ]);
    if ( empty($has_collision) ) return;

    $to_shift = get_posts([
        'post_type'      => 'manga_work',
        'posts_per_page' => -1,
        'post_status'    => 'any',
        'post__not_in'   => [ $current_post_id ],
        'meta_query'     => [[
            'key'     => $meta_key,
            'value'   => $new_order,
            'compare' => '>=',
            'type'    => 'NUMERIC',
        ]],
        'meta_key'       => $meta_key,
        'orderby'        => 'meta_value_num',
        'order'          => 'DESC',
        'fields'         => 'ids',
    ]);
    foreach ( $to_shift as $pid ) {
        $old = (int) get_post_meta( $pid, $meta_key, true );
        update_post_meta( $pid, $meta_key, $old + 1 );
    }
}

/* ── 赤ペン・ネーム メタ保存 ── */
add_action( 'save_post_cx_preproduction', 'cxcms_save_preproduction_meta' );
function cxcms_save_preproduction_meta( $post_id ) {
    if ( ! isset($_POST['cxcms_preprod_nonce']) || ! wp_verify_nonce($_POST['cxcms_preprod_nonce'], 'cxcms_preprod_save') ) return;
    if ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) return;
    $fields = ['cx_preprod_type','cx_preprod_related_work','cx_preprod_gallery','cx_preprod_sort_order'];
    foreach ( $fields as $f ) {
        if ( isset($_POST[$f]) ) update_post_meta( $post_id, $f, sanitize_text_field($_POST[$f]) );
    }
}

add_action( 'save_post_cx_news', 'cxcms_save_news_meta' );
function cxcms_save_news_meta( $post_id ) {
    if ( ! isset($_POST['cxcms_news_nonce']) || ! wp_verify_nonce($_POST['cxcms_news_nonce'], 'cxcms_news_save') ) return;
    if ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) return;
    /* 掲載先（チェックボックス複数）。nonce検証済みの本編集画面のみ到達するので、
       未チェック＝意図的な「どこにも表示しない」として保存する */
    update_post_meta( $post_id, 'cx_news_show_site', cxcms_sanitize_show_site_post( $_POST['cx_news_show_site'] ?? [] ) );
    $fields = [
        'cx_news_title_en','cx_news_url',
        // 旧フィールド（後方互換のため残置）
        'cx_news_image_position','cx_news_image_fit',
        'cx_news_image_mode','cx_news_image_crop_x','cx_news_image_crop_y','cx_news_image_crop_w','cx_news_image_crop_h',
        // 新フィールド: ホーム/一覧表示用
        'cx_news_image_mode_top','cx_news_image_crop_x_top','cx_news_image_crop_y_top','cx_news_image_crop_w_top','cx_news_image_crop_h_top',
        // 新フィールド: 記事詳細ページ用
        'cx_news_image_mode_detail','cx_news_image_crop_x_detail','cx_news_image_crop_y_detail','cx_news_image_crop_w_detail','cx_news_image_crop_h_detail',
    ];
    foreach ( $fields as $f ) {
        if ( isset($_POST[$f]) ) update_post_meta( $post_id, $f, sanitize_text_field($_POST[$f]) );
    }
    /* 本文英語はHTMLタグ許可のためwp_kses_post */
    if ( isset($_POST['cx_news_content_en']) ) {
        update_post_meta( $post_id, 'cx_news_content_en', wp_kses_post($_POST['cx_news_content_en']) );
    }
}

/* ── ニュース一覧画面にカスタム列を追加（英語入力状況） ── */
add_filter( 'manage_cx_news_posts_columns', 'cxcms_news_columns' );
function cxcms_news_columns( $cols ) {
    $new = [];
    foreach ( $cols as $k => $v ) {
        $new[$k] = $v;
        if ( $k === 'title' ) {
            $new['cx_en_title']   = 'ENタイトル';
            $new['cx_en_content'] = 'EN本文';
        }
    }
    return $new;
}
add_action( 'manage_cx_news_posts_custom_column', 'cxcms_news_columns_render', 10, 2 );
function cxcms_news_columns_render( $col, $post_id ) {
    if ( $col === 'cx_en_title' ) {
        $v = get_post_meta( $post_id, 'cx_news_title_en', true );
        echo $v ? '<span style="color:#2ecc71;font-size:16px">✓</span>' : '<span style="color:#bbb">—</span>';
    }
    if ( $col === 'cx_en_content' ) {
        $v = get_post_meta( $post_id, 'cx_news_content_en', true );
        echo $v ? '<span style="color:#2ecc71;font-size:16px">✓</span>' : '<span style="color:#bbb">—</span>';
    }
}


/* ==========================================================
   3. REST API カスタムフィールドを公開
   ========================================================== */

add_action( 'rest_api_init', 'cxcms_register_rest_fields' );

function cxcms_register_rest_fields() {

    /* ── 漫画事例のフィールド ── */
    $manga_fields = ['cx_work_id','cx_title_en','cx_subtitle_ja','cx_subtitle_en','cx_pages','cx_client','cx_client_url','cx_cta_label_ja','cx_cta_label_en','cx_cta_enabled','cx_spec_pages','cx_spec_period','cx_media','cx_point','cx_comment','cx_sort_order','cx_hero_order_bm','cx_hero_order_cx','cx_is_new','cx_added_date','cx_show_library','cx_show_site','cx_show_gallery_bizmanga','cx_show_new_contentsx','cx_private'];
    foreach ( $manga_fields as $f ) {
        register_rest_field( 'manga_work', $f, [
            'get_callback' => fn($obj) => get_post_meta( $obj['id'], $f, true ),
            'schema'       => [ 'type' => 'string' ],
        ]);
    }

    /* ── お客様の声のフィールド ── */
    $testimonial_fields = ['cx_testimonial_heading','cx_testimonial_heading_en','cx_testimonial_excerpt','cx_testimonial_excerpt_en','cx_testimonial_img_position','cx_testimonial_order','cx_testimonial_show_site'];
    foreach ( $testimonial_fields as $f ) {
        register_rest_field( 'cx_testimonial', $f, [
            'get_callback' => fn($obj) => get_post_meta( $obj['id'], $f, true ),
            'schema'       => [ 'type' => 'string' ],
        ]);
    }

    /* ── ニュースのフィールド ── */
    $news_fields = ['cx_news_title_en','cx_news_url','cx_news_show_site'];
    foreach ( $news_fields as $f ) {
        register_rest_field( 'cx_news', $f, [
            'get_callback' => fn($obj) => get_post_meta( $obj['id'], $f, true ),
            'schema'       => [ 'type' => 'string' ],
        ]);
    }
}


/* ==========================================================
   4. CORS ヘッダー（フロントサイトからのAPI呼び出し許可）
   ========================================================== */

/* 許可オリジン一覧 */
function cxcms_allowed_origins() {
    return [
        'https://contentsx.jp',
        'https://www.contentsx.jp',
        'https://bizmanga.contentsx.jp',
        'https://ichioshi.contentsx.jp',   // イチオシ採用 (2026-07-09 ドメイン改名)
        'https://recruitx.contentsx.jp',   // イチオシ採用の旧ドメイン (移行期間中残置、安定後に削除可)
        'http://localhost:3000',
        'http://127.0.0.1:5500',       // VS Code Live Server
    ];
}

/* ── (A) OPTIONS プリフライトを WordPress 処理前に返す ── */
add_action( 'init', function() {
    $origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? $_SERVER['HTTP_ORIGIN'] : '';
    if ( empty( $origin ) ) return;

    /* REST API パスへのリクエストのみ対象 */
    $req = isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : '';
    if ( strpos( $req, '/wp-json/' ) === false && strpos( $req, 'rest_route=' ) === false ) return;

    header( 'Vary: Origin' );
    if ( in_array( $origin, cxcms_allowed_origins(), true ) ) {
        header( 'Access-Control-Allow-Origin: ' . $origin );
        header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
        header( 'Access-Control-Allow-Headers: Content-Type, Authorization' );
        header( 'Access-Control-Allow-Credentials: true' );
        header( 'Access-Control-Max-Age: 86400' );
    }

    /* OPTIONS プリフライトは即座に 200 を返して終了 */
    if ( isset( $_SERVER['REQUEST_METHOD'] ) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS' ) {
        status_header( 200 );
        exit;
    }
}, 1 );

/* ── (B) REST レスポンスにも CORS ヘッダーを付与 ── */
add_action( 'rest_api_init', function() {
    remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
    add_filter( 'rest_pre_serve_request', function( $value ) {
        $origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? $_SERVER['HTTP_ORIGIN'] : '';
        header( 'Vary: Origin' );
        if ( in_array( $origin, cxcms_allowed_origins(), true ) ) {
            header( 'Access-Control-Allow-Origin: ' . $origin );
        }
        header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
        header( 'Access-Control-Allow-Headers: Content-Type, Authorization' );
        header( 'Access-Control-Allow-Credentials: true' );
        return $value;
    });
}, 15 );


/* ==========================================================
   5. 専用 REST エンドポイント（整形済みデータ）
   ========================================================== */

add_action( 'rest_api_init', function() {

    /* GET /wp-json/contentsx/v1/works — 全漫画事例（フロント用整形済み） */
    register_rest_route( 'contentsx/v1', '/works', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_works',
        'permission_callback' => '__return_true',
    ]);

    /* GET /wp-json/contentsx/v1/works-new — 新作情報のみ */
    register_rest_route( 'contentsx/v1', '/works-new', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_works_new',
        'permission_callback' => '__return_true',
    ]);

    /* GET /wp-json/contentsx/v1/news — ニュース一覧 */
    register_rest_route( 'contentsx/v1', '/news', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_news',
        'permission_callback' => '__return_true',
    ]);

    /* GET /wp-json/contentsx/v1/news/{id} — ニュース個別 */
    register_rest_route( 'contentsx/v1', '/news/(?P<id>\d+)', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_news_single',
        'permission_callback' => '__return_true',
        'args' => [
            'id' => [
                'validate_callback' => function($v) { return is_numeric($v); },
            ],
        ],
    ]);

    /* GET /wp-json/contentsx/v1/testimonials — お客様の声一覧 */
    register_rest_route( 'contentsx/v1', '/testimonials', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_testimonials',
        'permission_callback' => '__return_true',
    ]);

    /* GET /wp-json/contentsx/v1/testimonials/{id} — お客様の声 個別（本文含む） */
    register_rest_route( 'contentsx/v1', '/testimonials/(?P<id>\d+)', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_testimonial_single',
        'permission_callback' => '__return_true',
        'args' => [
            'id' => [
                'validate_callback' => function($v) { return is_numeric($v); },
            ],
        ],
    ]);

    /* GET /wp-json/contentsx/v1/library — ビズ書庫用（漫画を読むページ） */
    register_rest_route( 'contentsx/v1', '/library', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_library',
        'permission_callback' => '__return_true',
    ]);

    /* GET /wp-json/contentsx/v1/manga/(?P<id>[a-z0-9-]+) — QRダイレクトアクセス用（単一作品、表示フラグ無関係） */
    register_rest_route( 'contentsx/v1', '/manga/(?P<id>[a-z0-9-]+)', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_manga_single',
        'permission_callback' => '__return_true',
        'args' => [
            'id' => [ 'required' => true, 'sanitize_callback' => 'sanitize_title' ],
        ],
    ]);

    /* GET /wp-json/contentsx/v1/preproduction — 赤ペン・ネーム一覧 */
    register_rest_route( 'contentsx/v1', '/preproduction', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_preproduction',
        'permission_callback' => '__return_true',
    ]);
});

/* ── ヘルパー: 漫画事例の共通データ整形 ── */
function cxcms_format_work( $p ) {
    $m = fn($k) => get_post_meta( $p->ID, $k, true );
    $media_raw = $m('cx_media');
    $media = $media_raw ? array_map('trim', explode(',', str_replace('、', ',', $media_raw))) : [];

    /* アイキャッチ画像URL（表紙）— medium でサムネイル軽量化 */
    $thumb_url = '';
    $thumb_id = get_post_thumbnail_id( $p->ID );
    if ( $thumb_id ) {
        $img = wp_get_attachment_image_src( $thumb_id, 'medium' );
        if ( $img ) $thumb_url = $img[0];
    }

    /* ギャラリー画像 */
    $gallery_urls = [];
    $gallery_ids = $m('cx_gallery');
    if ( $gallery_ids ) {
        foreach ( array_filter( array_map('trim', explode(',', $gallery_ids)) ) as $att_id ) {
            $img = wp_get_attachment_image_src( (int)$att_id, 'full' );
            if ( $img ) $gallery_urls[] = $img[0];
        }
    }

    /* アイキャッチ未設定 → ギャラリー1枚目を表紙として使用 */
    if ( empty( $thumb_url ) && ! empty( $gallery_urls ) ) {
        $thumb_url = $gallery_urls[0];
    }

    /* 赤ペンギャラリー */
    $akapen_urls = [];
    $akapen_ids = $m('cx_akapen_gallery');
    if ( $akapen_ids ) {
        foreach ( array_filter( array_map('trim', explode(',', $akapen_ids)) ) as $att_id ) {
            $img = wp_get_attachment_image_src( (int)$att_id, 'full' );
            if ( $img ) $akapen_urls[] = $img[0];
        }
    }

    /* ネームギャラリー */
    $name_urls = [];
    $name_ids = $m('cx_name_gallery');
    if ( $name_ids ) {
        foreach ( array_filter( array_map('trim', explode(',', $name_ids)) ) as $att_id ) {
            $img = wp_get_attachment_image_src( (int)$att_id, 'full' );
            if ( $img ) $name_urls[] = $img[0];
        }
    }

    /* manga_category の全term（複数カテゴリ対応） */
    $cat_names = [];
    $cat_terms = get_the_terms( $p->ID, 'manga_category' );
    if ( $cat_terms && ! is_wp_error($cat_terms) ) {
        foreach ( $cat_terms as $t ) {
            $cat_names[] = $t->name;
        }
    }

    return [
        'id'          => $m('cx_work_id') ?: sanitize_title($p->post_title),
        'title_ja'    => $p->post_title,
        'title_en'    => $m('cx_title_en'),
        'subtitle_ja' => $m('cx_subtitle_ja') ?: $p->post_title,
        'subtitle_en' => $m('cx_subtitle_en') ?: ( $m('cx_title_en') ?: $p->post_title ),
        'pages'       => (int) $m('cx_pages'),
        'category'  => ! empty($cat_names) ? $cat_names[0] : '',
        'categories' => $cat_names,
        'client'    => $m('cx_client'),
        'client_url'    => $m('cx_client_url'),
        'cta_label_ja'  => $m('cx_cta_label_ja'),
        'cta_label_en'  => $m('cx_cta_label_en'),
        'cta_enabled'   => $m('cx_cta_enabled') === '1',
        'media'     => $media,
        'spec'      => [
            'pages'  => $m('cx_spec_pages'),
            'period' => $m('cx_spec_period'),
        ],
        'point'     => $m('cx_point'),
        'comment'   => $m('cx_comment'),
        'show_hero'    => $m('cx_show_hero') !== '0',
        'show_hero_site' => $m('cx_show_hero_site') ?: ( $m('cx_show_hero') !== '0' ? 'both' : 'none' ),
        'hero_order_bm' => (int) ( $m('cx_hero_order_bm') ?: 9999 ),
        'hero_order_cx' => (int) ( $m('cx_hero_order_cx') ?: 9999 ),
        /* hero_row_bm/hero_col_bm: 廃止（順番ベース自動振り分けに移行） */
        'show_library' => $m('cx_show_library') !== '0',
        'show_site'    => $m('cx_show_site') ?: 'both',
        'modified_ymd' => get_the_modified_date( 'Y-m-d', $p ),   // sitemap lastmod用の実更新日 (2026-06-12)
        'mode'      => $m('cx_vertical_read') === '1' ? 'vertical' : 'carousel',
        'view_type' => $m('cx_vertical_read') === '1' ? 'vertical_only' : 'spread',
        'thumbnail' => $thumb_url,
        'gallery'   => $gallery_urls,
        'akapen_gallery' => $akapen_urls,
        'name_gallery'   => $name_urls,
    ];
}

/* ── ヘルパー: サイトフィルター (2026-06-12 多サイト化 / 2026-07-09 recruitx→ichioshi 改名) ──
   掲載先メタの値:
     旧形式 'both' / 'bizmanga' / 'contentsx'  (2サイト時代の単一値)
     新形式 CSV   'bizmanga,contentsx' / 'ichioshi' など複数可、'none'=非表示
   ⚠ 'both' は「BizManga+ContentsX」の意味で固定。ichioshi等の新サイトに漏らさないこと
   ⚠ 旧キー 'recruitx' はDB保存値・APIパラメータとも読み込み時に 'ichioshi' へ正規化
     （DB移行不要で過去データ互換。新規保存は常に 'ichioshi'） */
function cxcms_normalize_site_key( $key ) {
    return $key === 'recruitx' ? 'ichioshi' : $key;
}

function cxcms_show_site_list( $value ) {
    $value = trim( (string) $value );
    if ( $value === '' || $value === 'both' ) return [ 'bizmanga', 'contentsx' ];
    if ( $value === 'none' ) return [];
    $list = array_values( array_filter( array_map( 'trim', explode( ',', $value ) ) ) );
    return array_values( array_unique( array_map( 'cxcms_normalize_site_key', $list ) ) );
}

function cxcms_filter_by_site( $items, $site_param, $site_key = 'show_site' ) {
    if ( empty( $site_param ) ) return $items;
    $site = cxcms_normalize_site_key( sanitize_text_field( $site_param ) );
    return array_values( array_filter( $items, function( $item ) use ( $site, $site_key ) {
        return in_array( $site, cxcms_show_site_list( $item[ $site_key ] ?? 'both' ), true );
    }));
}

/* 掲載先チェックボックスUI（ニュース・コラム共通）。旧値('both'等)も正しくチェック表示する */
function cxcms_show_site_checkboxes_html( $field_name, $current_value ) {
    $checked = cxcms_show_site_list( $current_value ?: 'both' );
    $sites = [ 'bizmanga' => 'BizManga', 'contentsx' => 'ContentsX', 'ichioshi' => 'イチオシ採用' ];
    foreach ( $sites as $key => $label ) {
        printf(
            '<label style="display:inline-flex;align-items:center;gap:4px;margin-right:14px;font-weight:400"><input type="checkbox" name="%1$s[]" value="%2$s" %3$s> %4$s</label>',
            esc_attr( $field_name ),
            esc_attr( $key ),
            checked( in_array( $key, $checked, true ), true, false ),
            esc_html( $label )
        );
    }
}

/* 掲載先チェックボックスの保存値を正規化(CSV)。未チェック='none'(どこにも表示しない) */
function cxcms_sanitize_show_site_post( $raw ) {
    $allowed = [ 'bizmanga', 'contentsx', 'ichioshi' ];
    $vals = array_map( 'cxcms_normalize_site_key', array_map( 'sanitize_text_field', (array) $raw ) );
    $vals = array_values( array_intersect( $vals, $allowed ) );
    return $vals ? implode( ',', $vals ) : 'none';
}

/* 掲載先の管理画面一覧用ラベル */
function cxcms_show_site_label( $value ) {
    $list = cxcms_show_site_list( $value ?: 'both' );
    if ( ! $list ) return '非表示';
    $map = [ 'bizmanga' => 'BM', 'contentsx' => 'CX', 'ichioshi' => 'イチオシ' ];
    return implode( '+', array_map( fn($s) => $map[$s] ?? $s, $list ) );
}

/* ── 全漫画事例 ── */
/* ?site=bizmanga or ?site=contentsx でフィルタリング可能 */
function cxcms_api_works( $req ) {
    $posts = get_posts([
        'post_type'      => 'manga_work',
        'posts_per_page' => 100,
        'meta_key'       => 'cx_sort_order',
        'orderby'        => 'meta_value_num',
        'order'          => 'ASC',
        'post_status'    => 'publish',
    ]);
    $out = [];
    foreach ( $posts as $p ) {
        /* 完全非公開作品は全エンドポイントから除外 */
        if ( get_post_meta( $p->ID, 'cx_private', true ) === '1' ) continue;
        $out[] = cxcms_format_work( $p );
    }
    $out = cxcms_filter_by_site( $out, $req->get_param('site') );
    return new WP_REST_Response( $out, 200 );
}

/* ── 新作情報 / ギャラリー ── */
/* ?site=bizmanga → cx_show_gallery_bizmanga=1 の作品を返す（BizMangaギャラリー）
   ?site=contentsx → cx_show_new_contentsx=1 の作品を返す（ContentsX新作情報）
   ?site= 未指定  → cx_is_new=1 でフォールバック（後方互換） */
function cxcms_api_works_new( $req ) {
    $site = $req->get_param('site') ?: '';

    /* サイト別フィルタ用のmeta_query構築 */
    $meta_query = [];
    if ( $site === 'bizmanga' ) {
        $meta_query[] = [ 'key' => 'cx_show_gallery_bizmanga', 'value' => '1' ];
    } elseif ( $site === 'contentsx' ) {
        $meta_query[] = [ 'key' => 'cx_show_new_contentsx', 'value' => '1' ];
    } else {
        /* 後方互換: 旧 cx_is_new フラグでフォールバック */
        $meta_query[] = [
            'relation' => 'OR',
            [ 'key' => 'cx_show_gallery_bizmanga', 'value' => '1' ],
            [ 'key' => 'cx_show_new_contentsx', 'value' => '1' ],
            [ 'key' => 'cx_is_new', 'value' => '1' ],
        ];
    }

    /* 表示順: cx_sort_order 昇順 → 同順位は cx_added_date 降順（新しい順） */
    $posts = get_posts([
        'post_type'      => 'manga_work',
        'posts_per_page' => 20,
        'orderby'        => [ 'meta_value_num' => 'ASC', 'date' => 'DESC' ],
        'meta_key'       => 'cx_sort_order',
        'post_status'    => 'publish',
        'meta_query'     => $meta_query,
    ]);
    $out = [];
    foreach ( $posts as $p ) {
        /* 完全非公開作品を除外 */
        if ( get_post_meta( $p->ID, 'cx_private', true ) === '1' ) continue;
        $m = fn($k) => get_post_meta( $p->ID, $k, true );
        $thumb_url = '';
        $thumb_id = get_post_thumbnail_id( $p->ID );
        if ( $thumb_id ) {
            $img = wp_get_attachment_image_src( $thumb_id, 'medium' );
            if ( $img ) $thumb_url = $img[0];
        }
        if ( empty( $thumb_url ) ) {
            $gallery_ids = $m('cx_gallery');
            if ( $gallery_ids ) {
                $first_id = (int) strtok( $gallery_ids, ',' );
                if ( $first_id ) {
                    $img = wp_get_attachment_image_src( $first_id, 'full' );
                    if ( $img ) $thumb_url = $img[0];
                }
            }
        }
        $out[] = [
            'id'          => $m('cx_work_id') ?: sanitize_title($p->post_title),
            'title_ja'    => $p->post_title,
            'title_en'    => $m('cx_title_en'),
            'subtitle_ja' => $m('cx_subtitle_ja') ?: $p->post_title,
            'subtitle_en' => $m('cx_subtitle_en') ?: ( $m('cx_title_en') ?: $p->post_title ),
            'pages'       => (int) $m('cx_pages'),
            'added'       => $m('cx_added_date'),
            'sort_order'  => (int) ( $m('cx_sort_order') ?: 0 ),
            'show_site'   => $m('cx_show_site') ?: 'both',
            'thumbnail'   => $thumb_url,
            'view_type'   => $m('cx_vertical_read') === '1' ? 'vertical_only' : 'spread',
        ];
    }
    return new WP_REST_Response( array_slice($out, 0, 10), 200 );
}

/* ── ニュース一覧 ── */
/* ?site=bizmanga or ?site=contentsx でフィルタリング可能 */
function cxcms_api_news( $req ) {
    $limit = (int) ($req->get_param('per_page') ?: 10);
    $posts = get_posts([
        'post_type'      => 'cx_news',
        'posts_per_page' => min( $limit, 50 ),
        'orderby'        => 'date',
        'order'          => 'DESC',
        'post_status'    => 'publish',
    ]);
    $out = [];
    foreach ( $posts as $p ) {
        $m = fn($k) => get_post_meta( $p->ID, $k, true );
        $tag = cxcms_get_first_term( $p->ID, 'news_tag' );
        $content = apply_filters( 'the_content', $p->post_content );
        $has_detail = ! empty( trim( $p->post_content ) );
        $thumb_url = '';
        $thumb_id = get_post_thumbnail_id( $p->ID );
        if ( $thumb_id ) {
            $img = wp_get_attachment_image_src( $thumb_id, 'medium_large' );
            if ( $img ) $thumb_url = $img[0];
        }
        $out[] = [
            'id'        => $p->ID,
            'date'      => get_the_date( 'Y.m.d', $p ),
            'tag_ja'    => $tag,
            'tag_en'    => cxcms_get_first_term_en( $p->ID, 'news_tag' ),
            'title_ja'  => $p->post_title,
            'title_en'  => $m('cx_news_title_en'),
            'url'       => $m('cx_news_url') ?: '',
            'has_detail' => $has_detail,
            'show_site' => $m('cx_news_show_site') ?: 'both',
            'thumbnail' => $thumb_url,
            'image_position' => $m('cx_news_image_position') ?: '50% 50%',
            'image_fit'      => $m('cx_news_image_fit') ?: 'cover',
            'image_mode'     => $m('cx_news_image_mode') ?: 'contain',
            'image_crop_x'   => floatval($m('cx_news_image_crop_x')),
            'image_crop_y'   => floatval($m('cx_news_image_crop_y')),
            'image_crop_w'   => floatval($m('cx_news_image_crop_w')) ?: 100,
            'image_crop_h'   => floatval($m('cx_news_image_crop_h')) ?: 100,
            // 新: ホーム/一覧用（フォールバック: 旧 image_mode/crop_*）
            'image_mode_top'   => $m('cx_news_image_mode_top') ?: ($m('cx_news_image_mode') ?: 'contain'),
            'image_crop_x_top' => floatval($m('cx_news_image_crop_x_top') !== '' ? $m('cx_news_image_crop_x_top') : $m('cx_news_image_crop_x')),
            'image_crop_y_top' => floatval($m('cx_news_image_crop_y_top') !== '' ? $m('cx_news_image_crop_y_top') : $m('cx_news_image_crop_y')),
            'image_crop_w_top' => floatval($m('cx_news_image_crop_w_top') !== '' ? $m('cx_news_image_crop_w_top') : $m('cx_news_image_crop_w')) ?: 100,
            'image_crop_h_top' => floatval($m('cx_news_image_crop_h_top') !== '' ? $m('cx_news_image_crop_h_top') : $m('cx_news_image_crop_h')) ?: 100,
            // 新: 詳細ページ用
            'image_mode_detail'   => $m('cx_news_image_mode_detail') ?: ($m('cx_news_image_mode') ?: 'contain'),
            'image_crop_x_detail' => floatval($m('cx_news_image_crop_x_detail') !== '' ? $m('cx_news_image_crop_x_detail') : $m('cx_news_image_crop_x')),
            'image_crop_y_detail' => floatval($m('cx_news_image_crop_y_detail') !== '' ? $m('cx_news_image_crop_y_detail') : $m('cx_news_image_crop_y')),
            'image_crop_w_detail' => floatval($m('cx_news_image_crop_w_detail') !== '' ? $m('cx_news_image_crop_w_detail') : $m('cx_news_image_crop_w')) ?: 100,
            'image_crop_h_detail' => floatval($m('cx_news_image_crop_h_detail') !== '' ? $m('cx_news_image_crop_h_detail') : $m('cx_news_image_crop_h')) ?: 100,
        ];
    }
    $out = cxcms_filter_by_site( $out, $req->get_param('site') );
    return new WP_REST_Response( $out, 200 );
}

/* ── ニュース個別 ── */
function cxcms_api_news_single( $req ) {
    $post_id = (int) $req['id'];
    $p = get_post( $post_id );

    if ( ! $p || $p->post_type !== 'cx_news' || $p->post_status !== 'publish' ) {
        return new WP_Error( 'not_found', 'ニュースが見つかりません', [ 'status' => 404 ] );
    }

    $m = fn($k) => get_post_meta( $p->ID, $k, true );
    $tag = cxcms_get_first_term( $p->ID, 'news_tag' );
    $content = apply_filters( 'the_content', $p->post_content );
    $content_en_raw = $m('cx_news_content_en');
    $content_en = $content_en_raw ? apply_filters( 'the_content', $content_en_raw ) : '';

    /* アイキャッチ画像 */
    $thumb_url = '';
    $thumb_id = get_post_thumbnail_id( $p->ID );
    if ( $thumb_id ) {
        $img = wp_get_attachment_image_src( $thumb_id, 'large' );
        if ( $img ) $thumb_url = $img[0];
    }

    return new WP_REST_Response([
        'id'         => $p->ID,
        'date'       => get_the_date( 'Y.m.d', $p ),
        'tag_ja'     => $tag,
        'tag_en'     => cxcms_get_first_term_en( $p->ID, 'news_tag' ),
        'title_ja'   => $p->post_title,
        'title_en'   => $m('cx_news_title_en'),
        'url'        => $m('cx_news_url') ?: '',
        'thumbnail'  => $thumb_url,
        'image_position' => $m('cx_news_image_position') ?: '50% 50%',
        'image_fit'      => $m('cx_news_image_fit') ?: 'cover',
        'image_mode'     => $m('cx_news_image_mode') ?: 'contain',
        'image_crop_x'   => floatval($m('cx_news_image_crop_x')),
        'image_crop_y'   => floatval($m('cx_news_image_crop_y')),
        'image_crop_w'   => floatval($m('cx_news_image_crop_w')) ?: 100,
        'image_crop_h'   => floatval($m('cx_news_image_crop_h')) ?: 100,
        // 新: ホーム/一覧用
        'image_mode_top'   => $m('cx_news_image_mode_top') ?: ($m('cx_news_image_mode') ?: 'contain'),
        'image_crop_x_top' => floatval($m('cx_news_image_crop_x_top') !== '' ? $m('cx_news_image_crop_x_top') : $m('cx_news_image_crop_x')),
        'image_crop_y_top' => floatval($m('cx_news_image_crop_y_top') !== '' ? $m('cx_news_image_crop_y_top') : $m('cx_news_image_crop_y')),
        'image_crop_w_top' => floatval($m('cx_news_image_crop_w_top') !== '' ? $m('cx_news_image_crop_w_top') : $m('cx_news_image_crop_w')) ?: 100,
        'image_crop_h_top' => floatval($m('cx_news_image_crop_h_top') !== '' ? $m('cx_news_image_crop_h_top') : $m('cx_news_image_crop_h')) ?: 100,
        // 新: 詳細ページ用
        'image_mode_detail'   => $m('cx_news_image_mode_detail') ?: ($m('cx_news_image_mode') ?: 'contain'),
        'image_crop_x_detail' => floatval($m('cx_news_image_crop_x_detail') !== '' ? $m('cx_news_image_crop_x_detail') : $m('cx_news_image_crop_x')),
        'image_crop_y_detail' => floatval($m('cx_news_image_crop_y_detail') !== '' ? $m('cx_news_image_crop_y_detail') : $m('cx_news_image_crop_y')),
        'image_crop_w_detail' => floatval($m('cx_news_image_crop_w_detail') !== '' ? $m('cx_news_image_crop_w_detail') : $m('cx_news_image_crop_w')) ?: 100,
        'image_crop_h_detail' => floatval($m('cx_news_image_crop_h_detail') !== '' ? $m('cx_news_image_crop_h_detail') : $m('cx_news_image_crop_h')) ?: 100,
        'content'    => $content,
        'content_en' => $content_en,
    ], 200 );
}

/* ── 単一作品取得 (QRダイレクトアクセス用) ── */
/* 表示フラグに関係なく、cx_work_id で特定の作品を返す */
function cxcms_api_manga_single( $req ) {
    $manga_id = sanitize_title( $req->get_param('id') );
    if ( empty($manga_id) ) {
        return new WP_REST_Response( [ 'error' => 'missing id' ], 400 );
    }

    $posts = get_posts([
        'post_type'      => 'manga_work',
        'posts_per_page' => 1,
        'post_status'    => 'publish',
        'meta_query'     => [[
            'key'   => 'cx_work_id',
            'value' => $manga_id,
        ]],
    ]);

    if ( empty($posts) ) {
        /* cx_work_id が空の場合は slug で再検索（後方互換） */
        $posts = get_posts([
            'post_type'   => 'manga_work',
            'name'        => $manga_id,
            'post_status' => 'publish',
            'numberposts' => 1,
        ]);
    }

    if ( empty($posts) ) {
        return new WP_REST_Response( [ 'error' => 'not found' ], 404 );
    }

    /* 完全非公開作品はQR直リンクからもアクセス不可 */
    if ( get_post_meta( $posts[0]->ID, 'cx_private', true ) === '1' ) {
        return new WP_REST_Response( [ 'error' => 'not found' ], 404 );
    }

    return new WP_REST_Response( cxcms_format_work( $posts[0] ), 200 );
}

/* ── ビズ書庫（漫画を読むページ）── */
/* cx_show_library = '1'（デフォルト）の作品のみ返す */
function cxcms_api_library( $req ) {
    $posts = get_posts([
        'post_type'      => 'manga_work',
        'posts_per_page' => 100,
        'meta_key'       => 'cx_sort_order',
        'orderby'        => 'meta_value_num',
        'order'          => 'ASC',
        'post_status'    => 'publish',
    ]);
    $out = [];
    foreach ( $posts as $p ) {
        $m = fn($k) => get_post_meta( $p->ID, $k, true );

        /* 完全非公開作品を除外 */
        if ( $m('cx_private') === '1' ) continue;
        /* ビズ書庫非表示の作品をスキップ */
        if ( $m('cx_show_library') === '0' ) continue;

        $thumb_url = '';
        $thumb_id = get_post_thumbnail_id( $p->ID );
        if ( $thumb_id ) {
            $img = wp_get_attachment_image_src( $thumb_id, 'medium' );
            if ( $img ) $thumb_url = $img[0];
        }

        $gallery_urls = [];
        $gallery_ids = $m('cx_gallery');
        if ( $gallery_ids ) {
            foreach ( array_filter( array_map('trim', explode(',', $gallery_ids)) ) as $att_id ) {
                $img = wp_get_attachment_image_src( (int)$att_id, 'full' );
                if ( $img ) $gallery_urls[] = $img[0];
            }
        }
        if ( empty( $thumb_url ) && ! empty( $gallery_urls ) ) {
            $thumb_url = $gallery_urls[0];
        }

        /* 赤ペンギャラリー */
        $akapen_urls = [];
        $akapen_ids = $m('cx_akapen_gallery');
        if ( $akapen_ids ) {
            foreach ( array_filter( array_map('trim', explode(',', $akapen_ids)) ) as $att_id ) {
                $img = wp_get_attachment_image_src( (int)$att_id, 'full' );
                if ( $img ) $akapen_urls[] = $img[0];
            }
        }

        /* ネームギャラリー */
        $name_urls = [];
        $name_ids = $m('cx_name_gallery');
        if ( $name_ids ) {
            foreach ( array_filter( array_map('trim', explode(',', $name_ids)) ) as $att_id ) {
                $img = wp_get_attachment_image_src( (int)$att_id, 'full' );
                if ( $img ) $name_urls[] = $img[0];
            }
        }

        /* タグ（manga_category の全term） */
        $tags = [];
        $terms = get_the_terms( $p->ID, 'manga_category' );
        if ( $terms && ! is_wp_error($terms) ) {
            foreach ( $terms as $term ) {
                $tags[] = $term->name;
            }
        }

        $out[] = [
            'id'        => $m('cx_work_id') ?: sanitize_title($p->post_title),
            'title_ja'  => $p->post_title,
            'title_en'  => $m('cx_title_en'),
            'pages'     => (int) $m('cx_pages'),
            'category'  => ! empty($tags) ? $tags[0] : '',
            'tags'      => $tags,
            'thumbnail' => $thumb_url,
            'gallery'   => $gallery_urls,
            'akapen_gallery' => $akapen_urls,
            'name_gallery'   => $name_urls,
            'client_url'     => $m('cx_client_url'),
            'cta_label_ja'   => $m('cx_cta_label_ja'),
            'cta_label_en'   => $m('cx_cta_label_en'),
            'cta_enabled'    => $m('cx_cta_enabled') === '1',
            'view_type'      => $m('cx_vertical_read') === '1' ? 'vertical_only' : 'spread',
        ];
    }
    return new WP_REST_Response( $out, 200 );
}

/* ── ヘルパー ── */
function cxcms_get_first_term( $post_id, $taxonomy ) {
    $terms = get_the_terms( $post_id, $taxonomy );
    return ( $terms && ! is_wp_error($terms) ) ? $terms[0]->name : '';
}
function cxcms_get_first_term_en( $post_id, $taxonomy ) {
    $terms = get_the_terms( $post_id, $taxonomy );
    if ( ! $terms || is_wp_error($terms) ) return '';
    $en = get_term_meta( $terms[0]->term_id, 'term_en', true );
    return $en ?: $terms[0]->name;
}


/* ==========================================================
   6. タクソノミーに英語名フィールドを追加
   ========================================================== */

add_action( 'news_tag_add_form_fields', function() {
    echo '<div class="form-field"><label>英語名</label><input name="term_en" value=""><p class="description">英語サイトで表示される名前</p></div>';
});
add_action( 'news_tag_edit_form_fields', function($term) {
    $val = get_term_meta( $term->term_id, 'term_en', true );
    echo '<tr class="form-field"><th><label>英語名</label></th><td><input name="term_en" value="'.esc_attr($val).'"></td></tr>';
});
add_action( 'created_news_tag', function($term_id) {
    if ( isset($_POST['term_en']) ) update_term_meta( $term_id, 'term_en', sanitize_text_field($_POST['term_en']) );
});
add_action( 'edited_news_tag', function($term_id) {
    if ( isset($_POST['term_en']) ) update_term_meta( $term_id, 'term_en', sanitize_text_field($_POST['term_en']) );
});

// manga_category にも同様
add_action( 'manga_category_add_form_fields', function() {
    echo '<div class="form-field"><label>英語名</label><input name="term_en" value=""></div>';
});
add_action( 'manga_category_edit_form_fields', function($term) {
    $val = get_term_meta( $term->term_id, 'term_en', true );
    echo '<tr class="form-field"><th><label>英語名</label></th><td><input name="term_en" value="'.esc_attr($val).'"></td></tr>';
});
add_action( 'created_manga_category', function($id) {
    if ( isset($_POST['term_en']) ) update_term_meta( $id, 'term_en', sanitize_text_field($_POST['term_en']) );
});
add_action( 'edited_manga_category', function($id) {
    if ( isset($_POST['term_en']) ) update_term_meta( $id, 'term_en', sanitize_text_field($_POST['term_en']) );
});


/* ==========================================================
   7. 管理画面カスタマイズ
   ========================================================== */

/* 漫画事例の一覧カラム */
add_filter( 'manage_manga_work_posts_columns', function($cols) {
    $new = [];
    foreach ( $cols as $k => $v ) {
        if ( $k === 'title' ) {
            $new['cx_thumb'] = '表紙';
        }
        $new[$k] = $v;
        if ( $k === 'title' ) {
            $new['cx_subtitle'] = 'サブタイトル';
            $new['cx_work_id'] = 'ID';
            $new['cx_client']  = 'クライアント';
            $new['cx_pages']   = 'ページ';
            $new['cx_show_hero_site'] = 'Hero';
            $new['cx_hero_order_bm'] = 'BM順';
            $new['cx_hero_order_cx'] = 'CX順';
            $new['cx_is_new']  = '新作';
            $new['cx_show_library'] = '書庫';
            $new['cx_show_site'] = 'BM事例';
        }
    }
    return $new;
});
add_action( 'manage_manga_work_posts_custom_column', function($col, $id) {
    if ( $col === 'cx_thumb' ) {
        $thumb_id = get_post_thumbnail_id( $id );
        $img_url = '';
        if ( $thumb_id ) {
            $img = wp_get_attachment_image_src( $thumb_id, 'thumbnail' );
            if ( $img ) $img_url = $img[0];
        }
        if ( ! $img_url ) {
            $gallery = get_post_meta( $id, 'cx_gallery', true );
            if ( $gallery ) {
                $first_id = (int) strtok( $gallery, ',' );
                if ( $first_id ) {
                    $img = wp_get_attachment_image_src( $first_id, 'thumbnail' );
                    if ( $img ) $img_url = $img[0];
                }
            }
        }
        if ( $img_url ) {
            echo '<img src="' . esc_url($img_url) . '" style="width:40px;height:56px;object-fit:cover;border-radius:3px;">';
        } else {
            echo '—';
        }
        return;
    }
    if ( $col === 'cx_subtitle' ) {
        $ja = get_post_meta( $id, 'cx_subtitle_ja', true );
        $en = get_post_meta( $id, 'cx_subtitle_en', true );
        // クイック編集JSが読み取る隠しデータ
        echo '<span class="cx-qe-subtitle-ja-data" style="display:none">' . esc_html($ja) . '</span>';
        echo '<span class="cx-qe-subtitle-en-data" style="display:none">' . esc_html($en) . '</span>';
        echo $ja !== '' ? esc_html($ja) : '<span style="color:#bbb">—</span>';
        return;
    }
    $v = get_post_meta( $id, $col, true );
    if ( $col === 'cx_show_hero_site' ) {
        $hs = $v ?: ( get_post_meta($id, 'cx_show_hero', true) !== '0' ? 'both' : 'none' );
        $labels = ['both'=>'両方','bizmanga'=>'BM','contentsx'=>'CX','none'=>'—'];
        echo esc_html( $labels[$hs] ?? '両方' );
        return;
    }
    if ( $col === 'cx_hero_order_bm' || $col === 'cx_hero_order_cx' ) {
        echo $v ? '<strong>' . esc_html($v) . '</strong>' : '<span style="color:#bbb">—</span>';
        return;
    }
    if ( $col === 'cx_is_new' ) { echo $v === '1' ? '✅' : '—'; return; }
    if ( $col === 'cx_show_library' ) { echo $v !== '0' ? '✅' : '—'; return; }
    if ( $col === 'cx_show_site' ) {
        echo ($v === 'contentsx') ? '—' : '✅';
        return;
    }
    echo esc_html( $v ?: '—' );
}, 10, 2 );

/* ── 漫画事例 ドラッグ並べ替え ── */

// 並べ替え列を追加
add_filter( 'manage_manga_work_posts_columns', function($cols) {
    $cols['cx_sort_order'] = '順番';
    return $cols;
}, 20 );
add_action( 'manage_manga_work_posts_custom_column', function($col, $id) {
    if ( $col === 'cx_sort_order' ) {
        $order = get_post_meta($id, 'cx_sort_order', true) ?: '0';
        echo '<span class="cx-sort-num">' . esc_html($order) . '</span>';
    }
}, 20, 2 );

// デフォルトのソート順をcx_sort_orderにする
add_action( 'pre_get_posts', function($q) {
    if ( ! is_admin() || ! $q->is_main_query() ) return;
    if ( $q->get('post_type') !== 'manga_work' ) return;
    if ( ! $q->get('orderby') ) {
        $q->set('meta_key', 'cx_sort_order');
        $q->set('orderby', 'meta_value_num');
        $q->set('order', 'ASC');
    }
});

// ドラッグ用JS・CSSを漫画事例一覧でのみ読み込む
add_action( 'admin_enqueue_scripts', function($hook) {
    global $post_type;
    if ( $hook !== 'edit.php' || $post_type !== 'manga_work' ) return;

    wp_enqueue_script('jquery-ui-sortable');

    $css = '
        #the-list tr { cursor: grab; }
        #the-list tr.ui-sortable-helper { background: #fff3cd; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        #the-list tr.cx-drag-placeholder { height: 60px; background: #e8f0fe; }
        .cx-sort-saving { position: fixed; top: 32px; right: 20px; background: #2271b1; color: #fff; padding: 8px 16px; border-radius: 4px; z-index: 9999; font-weight: 600; }
    ';
    wp_add_inline_style('wp-admin', $css);

    $js = "
    jQuery(function($){
        var list = $('#the-list');
        if (!list.length) return;

        list.sortable({
            items: 'tr',
            axis: 'y',
            handle: 'td',
            placeholder: 'cx-drag-placeholder',
            cursor: 'grabbing',
            opacity: 0.8,
            update: function(e, ui) {
                var notice = $('<div class=\"cx-sort-saving\">保存中...</div>').appendTo('body');
                var order = [];
                list.find('tr').each(function(i){
                    var id = $(this).attr('id');
                    if (id) order.push(id.replace('post-',''));
                });
                $.post(ajaxurl, {
                    action: 'cxcms_sort_works',
                    order: order,
                    _wpnonce: '" . wp_create_nonce('cxcms_sort') . "'
                }, function(res){
                    notice.text(res.success ? '✅ 保存完了' : '❌ エラー');
                    setTimeout(function(){ notice.fadeOut(300, function(){ notice.remove(); }); }, 1500);
                    // 順番の数字を更新
                    list.find('tr').each(function(i){
                        $(this).find('.cx-sort-num').text(i + 1);
                    });
                }).fail(function(){
                    notice.text('❌ 通信エラー');
                    setTimeout(function(){ notice.fadeOut(300, function(){ notice.remove(); }); }, 2000);
                });
            }
        });
    });
    ";
    wp_add_inline_script('jquery-ui-sortable', $js);
});

// Ajax: 並べ替え保存
add_action( 'wp_ajax_cxcms_sort_works', function() {
    check_ajax_referer('cxcms_sort', '_wpnonce');
    if ( ! current_user_can('manage_options') ) wp_send_json_error('権限がありません');

    $order = isset($_POST['order']) ? $_POST['order'] : [];
    if ( empty($order) ) wp_send_json_error('データがありません');

    // ページオフセットを考慮（2ページ目以降のドラッグ対応）
    $paged = isset($_POST['paged']) ? (int)$_POST['paged'] : 1;
    $per_page = 20;
    $offset = ($paged - 1) * $per_page;

    foreach ( $order as $i => $post_id ) {
        update_post_meta( (int)$post_id, 'cx_sort_order', $offset + $i + 1 );
    }
    wp_send_json_success();
});

/* ── タイトル重複チェック（投稿編集画面） ── */
add_action( 'admin_enqueue_scripts', function($hook) {
    global $post_type;
    if ( !in_array($hook, ['post.php','post-new.php']) ) return;
    if ( $post_type !== 'manga_work' ) return;

    $css = '
        .cx-dup-warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 10px 14px; margin: 8px 0 0; font-size: 13px; color: #856404; display: none; }
        .cx-dup-warning strong { color: #d63638; }
    ';
    wp_add_inline_style('wp-admin', $css);

    $js = "
    jQuery(function($){
        var titleInput = $('#title');
        if (!titleInput.length) return;
        var warning = $('<div class=\"cx-dup-warning\"></div>').insertAfter('#titlewrap');
        var timer = null;
        var currentPostId = $('#post_ID').val() || 0;

        titleInput.on('input', function(){
            clearTimeout(timer);
            var title = titleInput.val().trim();
            if (!title) { warning.hide(); return; }
            timer = setTimeout(function(){
                $.post(ajaxurl, {
                    action: 'cxcms_check_dup_title',
                    title: title,
                    post_id: currentPostId,
                    _wpnonce: '" . wp_create_nonce('cxcms_dup_check') . "'
                }, function(res){
                    if (res.success && res.data.found) {
                        warning.html('⚠️ <strong>同じタイトルの漫画事例が既に存在します:</strong> 「' + res.data.existing_title + '」(ID: ' + res.data.existing_id + ')。このまま保存すると重複になります。').show();
                    } else {
                        warning.hide();
                    }
                });
            }, 500);
        });
    });
    ";
    wp_add_inline_script('jquery', $js);
});

add_action( 'wp_ajax_cxcms_check_dup_title', function() {
    check_ajax_referer('cxcms_dup_check', '_wpnonce');
    $title = sanitize_text_field($_POST['title'] ?? '');
    $current_id = (int)($_POST['post_id'] ?? 0);
    if (empty($title)) wp_send_json_success(['found' => false]);

    $existing = get_posts([
        'post_type' => 'manga_work',
        'post_status' => 'any',
        'posts_per_page' => 1,
        'title' => $title,
        'exclude' => $current_id ? [$current_id] : [],
    ]);

    // get_posts の title パラメータは完全一致ではないのでダブルチェック
    $found = false;
    $existing_title = '';
    $existing_id = '';
    foreach ($existing as $p) {
        if (mb_strtolower(trim($p->post_title)) === mb_strtolower(trim($title))) {
            $found = true;
            $existing_title = $p->post_title;
            $existing_id = get_post_meta($p->ID, 'cx_work_id', true) ?: $p->ID;
            break;
        }
    }

    wp_send_json_success(['found' => $found, 'existing_title' => $existing_title, 'existing_id' => $existing_id]);
});

/* ── 漫画事例 クイック編集: サブタイトル ── */

// クイック編集フォームに入力欄を出力（cx_subtitle 列に紐付く）
add_action( 'quick_edit_custom_box', function( $column_name, $post_type ) {
    if ( $post_type !== 'manga_work' || $column_name !== 'cx_subtitle' ) return;
    ?>
    <fieldset class="inline-edit-col-right">
        <div class="inline-edit-col">
            <label class="inline-edit-group">
                <span class="title">サブタイトル(日)</span>
                <span class="input-text-wrap">
                    <input type="text" name="cx_qe_subtitle_ja" class="cx-qe-subtitle-ja" value="" placeholder="空欄ならタイトルを使用">
                </span>
            </label>
            <label class="inline-edit-group">
                <span class="title">サブタイトル(英)</span>
                <span class="input-text-wrap">
                    <input type="text" name="cx_qe_subtitle_en" class="cx-qe-subtitle-en" value="" placeholder="Leave blank to use title">
                </span>
            </label>
        </div>
    </fieldset>
    <?php
}, 10, 2 );

// クイック編集を開いた時に既存値を流し込むJS
add_action( 'admin_footer-edit.php', function() {
    global $post_type;
    if ( $post_type !== 'manga_work' ) return;
    ?>
    <script>
    (function($){
        if ( typeof inlineEditPost === 'undefined' ) return;
        var _edit = inlineEditPost.edit;
        inlineEditPost.edit = function( id ) {
            _edit.apply( this, arguments );
            var postId = 0;
            if ( typeof( id ) === 'object' ) postId = parseInt( this.getId( id ), 10 );
            if ( ! postId ) return;
            var $row  = $( '#post-' + postId );
            var $edit = $( '#edit-' + postId );
            $edit.find( 'input.cx-qe-subtitle-ja' ).val( $row.find( '.cx-qe-subtitle-ja-data' ).text() );
            $edit.find( 'input.cx-qe-subtitle-en' ).val( $row.find( '.cx-qe-subtitle-en-data' ).text() );
        };
    })(jQuery);
    </script>
    <?php
});

// クイック編集（inline-save）からの保存。通常の編集画面保存とは別経路。
add_action( 'save_post_manga_work', function( $post_id ) {
    if ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) return;
    if ( ! current_user_can( 'edit_post', $post_id ) ) return;
    // cx_qe_* はクイック編集フォームにしか存在しないので、これがある時のみ処理
    if ( isset($_POST['cx_qe_subtitle_ja']) ) {
        update_post_meta( $post_id, 'cx_subtitle_ja', sanitize_text_field( $_POST['cx_qe_subtitle_ja'] ) );
    }
    if ( isset($_POST['cx_qe_subtitle_en']) ) {
        update_post_meta( $post_id, 'cx_subtitle_en', sanitize_text_field( $_POST['cx_qe_subtitle_en'] ) );
    }
});

/* ニュースの一覧カラム */
add_filter( 'manage_cx_news_posts_columns', function($cols) {
    $new = [];
    foreach ( $cols as $k => $v ) {
        $new[$k] = $v;
        if ( $k === 'title' ) {
            $new['cx_news_url'] = 'リンク';
        }
    }
    return $new;
});
add_action( 'manage_cx_news_posts_custom_column', function($col, $id) {
    $v = get_post_meta( $id, $col, true );
    echo esc_html( $v ?: '—' );
}, 10, 2 );


/* ==========================================================
   8. セキュリティ強化（ヘッドレス運用向け）
   ========================================================== */

/*
 * 8-1. WordPress フロントエンド無効化
 * ─ CMSは裏方。フロント画面にアクセスされたら管理画面にリダイレクト
 * ─ REST API（/wp-json/）と管理画面（/wp-admin/）、ログイン画面は通す
 */
add_action( 'template_redirect', function() {
    if ( is_admin() ) return;
    if ( defined('REST_REQUEST') && REST_REQUEST ) return;

    /* wp-login.php, wp-cron.php 等は除外 */
    $script = basename( $_SERVER['SCRIPT_NAME'] ?? '' );
    if ( in_array( $script, ['wp-login.php', 'wp-cron.php', 'wp-comments-post.php', 'xmlrpc.php'], true ) ) return;

    /* それ以外は管理画面へリダイレクト */
    wp_redirect( admin_url(), 302 );
    exit;
});

/*
 * 8-2. REST API ユーザー情報の漏洩防止
 * ─ /wp-json/wp/v2/users はユーザー名が丸見えになるため無効化
 * ─ 認証済み管理者のみ許可
 */
add_filter( 'rest_endpoints', function( $endpoints ) {
    /* 未認証ユーザーには users エンドポイントを隠す */
    if ( ! current_user_can('manage_options') ) {
        unset( $endpoints['/wp/v2/users'] );
        unset( $endpoints['/wp/v2/users/(?P<id>[\d]+)'] );
    }
    return $endpoints;
});

/*
 * 8-3. 標準 REST API の制限
 * ─ contentsx/v1/* 以外の wp/v2 エンドポイントは認証必須に
 * ─ 未認証での投稿一覧・ページ一覧なども非公開に
 */
add_filter( 'rest_pre_dispatch', function( $result, $server, $request ) {
    $route = $request->get_route();

    /* 自前の contentsx/v1 エンドポイントは許可（公開用） */
    if ( strpos( $route, '/contentsx/v1/' ) === 0 ) return $result;

    /* wp/v2 の GET リクエストは認証必須 */
    if ( strpos( $route, '/wp/v2/' ) === 0 && ! current_user_can('edit_posts') ) {
        return new WP_Error(
            'rest_forbidden',
            'このエンドポイントへのアクセスは許可されていません。',
            [ 'status' => 403 ]
        );
    }

    return $result;
}, 10, 3 );

/*
 * 8-4. ユーザー列挙攻撃の防止
 * ─ ?author=1 でユーザー名が漏れるのをブロック
 */
add_action( 'init', function() {
    if ( isset($_GET['author']) && ! is_admin() ) {
        wp_redirect( home_url(), 301 );
        exit;
    }
});

/*
 * 8-5. XML-RPC 無効化
 * ─ ヘッドレス運用では不要。ブルートフォース攻撃の入口になるため遮断
 * ─ xmlrpc_enabled は認証系メソッドしか止めない（pingback/multicall が残る）ため、
 *   xmlrpc_methods で全メソッドを空にして完全遮断する
 */
add_filter( 'xmlrpc_enabled', '__return_false' );
add_filter( 'xmlrpc_methods', '__return_empty_array' );
add_filter( 'wp_headers', function( $headers ) {
    unset( $headers['X-Pingback'] );
    return $headers;
});

/*
 * 8-6. WordPress バージョン情報の非表示
 * ─ バージョン特定 → 既知の脆弱性を突く攻撃を防ぐ
 */
remove_action( 'wp_head', 'wp_generator' );
add_filter( 'the_generator', '__return_empty_string' );

/*
 * 8-7. ログイン試行の制限
 * ─ 同一IPから5回失敗 → 15分ロックアウト
 */
add_filter( 'authenticate', function( $user, $username, $password ) {
    if ( empty($username) ) return $user;

    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $transient_key = 'cxcms_login_' . md5($ip);
    $attempts = (int) get_transient( $transient_key );

    if ( $attempts >= 5 ) {
        return new WP_Error(
            'too_many_attempts',
            'ログイン試行回数が上限に達しました。15分後に再度お試しください。'
        );
    }

    return $user;
}, 30, 3 );

add_action( 'wp_login_failed', function( $username ) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $transient_key = 'cxcms_login_' . md5($ip);
    $attempts = (int) get_transient( $transient_key );
    set_transient( $transient_key, $attempts + 1, 15 * MINUTE_IN_SECONDS );
});

add_action( 'wp_login', function( $user_login, $user ) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    delete_transient( 'cxcms_login_' . md5($ip) );
}, 10, 2 );

/*
 * 8-8. REST API レスポンスキャッシュヘッダー
 * ─ CDN / ブラウザキャッシュ対応（公開エンドポイントのみ）
 */
add_filter( 'rest_post_dispatch', function( $response, $server, $request ) {
    $route = $request->get_route();
    if ( strpos( $route, '/contentsx/v1/' ) === 0 ) {
        $response->header( 'Cache-Control', 'public, max-age=300, s-maxage=600' );
    }
    return $response;
}, 10, 3 );

/*
 * 8-9. セキュリティヘッダーの追加
 * ─ 管理画面のクリックジャッキング・XSS 対策
 */
add_action( 'send_headers', function() {
    if ( ! defined('REST_REQUEST') ) {
        header( 'X-Content-Type-Options: nosniff' );
        header( 'X-Frame-Options: SAMEORIGIN' );
        header( 'Referrer-Policy: strict-origin-when-cross-origin' );
    }
});


/* ==========================================================
   赤ペン・ネーム 一覧カラム
   ========================================================== */

add_filter( 'manage_cx_preproduction_posts_columns', function($cols) {
    $new = [];
    foreach ($cols as $k => $v) {
        if ($k === 'title') {
            $new['cx_preprod_thumb'] = 'サムネイル';
        }
        $new[$k] = $v;
        if ($k === 'title') {
            $new['cx_preprod_type'] = 'タイプ';
            $new['cx_preprod_related'] = '関連作品';
            $new['cx_preprod_count'] = '画像数';
            $new['cx_preprod_order'] = '表示順';
        }
    }
    return $new;
});

add_action( 'manage_cx_preproduction_posts_custom_column', function($col, $id) {
    $m = function($k) use ($id) { return get_post_meta($id, $k, true); };
    switch ($col) {
        case 'cx_preprod_thumb':
            $gallery = $m('cx_preprod_gallery');
            if ($gallery) {
                $first_id = (int) explode(',', $gallery)[0];
                $img = wp_get_attachment_image_src($first_id, 'thumbnail');
                if ($img) echo '<img src="'.esc_url($img[0]).'" style="width:40px;height:55px;object-fit:cover;border-radius:3px;">';
                else echo '—';
            } else {
                echo '—';
            }
            break;
        case 'cx_preprod_type':
            $type = $m('cx_preprod_type') ?: 'akapen';
            if ($type === 'akapen') {
                echo '<span style="background:#e53935;color:#fff;padding:2px 8px;border-radius:3px;font-size:12px;">赤ペン</span>';
            } else {
                echo '<span style="background:#ff9800;color:#fff;padding:2px 8px;border-radius:3px;font-size:12px;">ネーム</span>';
            }
            break;
        case 'cx_preprod_related':
            $related = $m('cx_preprod_related_work');
            echo $related ? esc_html($related) : '—';
            break;
        case 'cx_preprod_count':
            $gallery = $m('cx_preprod_gallery');
            echo $gallery ? count(array_filter(explode(',', $gallery))) . '枚' : '0枚';
            break;
        case 'cx_preprod_order':
            echo esc_html($m('cx_preprod_sort_order') ?: '10');
            break;
    }
}, 10, 2 );

/* ==========================================================
   赤ペン・ネーム API エンドポイント
   ========================================================== */

/* 一覧: /wp-json/contentsx/v1/preproduction */
function cxcms_api_preproduction( $request ) {
    $type = $request->get_param('type'); // akapen or name
    $meta_query = [];
    if ( $type ) {
        $meta_query[] = [ 'key' => 'cx_preprod_type', 'value' => sanitize_text_field($type) ];
    }

    $posts = get_posts([
        'post_type'      => 'cx_preproduction',
        'posts_per_page' => 100,
        'post_status'    => 'publish',
        'meta_key'       => 'cx_preprod_sort_order',
        'orderby'        => 'meta_value_num',
        'order'          => 'ASC',
        'meta_query'     => $meta_query,
    ]);

    $items = [];
    foreach ( $posts as $p ) {
        $m = function($k) use ($p) { return get_post_meta($p->ID, $k, true); };

        $gallery_urls = [];
        $gallery_ids = $m('cx_preprod_gallery');
        if ( $gallery_ids ) {
            foreach ( array_filter( array_map('trim', explode(',', $gallery_ids)) ) as $att_id ) {
                $img = wp_get_attachment_image_src( (int)$att_id, 'full' );
                if ( $img ) $gallery_urls[] = $img[0];
            }
        }

        $items[] = [
            'id'           => $p->ID,
            'title'        => $p->post_title,
            'type'         => $m('cx_preprod_type') ?: 'akapen',
            'related_work' => $m('cx_preprod_related_work') ?: '',
            'gallery'      => $gallery_urls,
            'pages'        => count($gallery_urls),
            'order'        => (int)($m('cx_preprod_sort_order') ?: 10),
        ];
    }

    return rest_ensure_response( $items );
}


/* ==========================================================
   9. 漫画事例 管理ツール（重複チェック・エクスポート）
   ========================================================== */

add_action( 'admin_menu', function() {
    add_submenu_page(
        'edit.php?post_type=manga_work',
        '管理ツール',
        '管理ツール',
        'manage_options',
        'cxcms-import',
        'cxcms_import_page'
    );
});

function cxcms_import_page() {
    // 重複チェック＆修復
    if ( isset($_POST['cxcms_fix_duplicates']) && wp_verify_nonce($_POST['_wpnonce'], 'cxcms_import') ) {
        $result = cxcms_fix_duplicates();
        echo '<div class="notice notice-warning"><p>' . wp_kses_post($result) . '</p></div>';
    }

    $existing = get_posts(['post_type'=>'manga_work','posts_per_page'=>200,'post_status'=>'any','fields'=>'ids']);
    $existing_map = []; // cx_work_id => [post_ids]
    foreach ($existing as $pid) {
        $wid = get_post_meta($pid, 'cx_work_id', true);
        if ($wid) {
            if (!isset($existing_map[$wid])) $existing_map[$wid] = [];
            $existing_map[$wid][] = $pid;
        }
    }
    $dup_count = 0;
    foreach ($existing_map as $wid => $pids) {
        if (count($pids) > 1) $dup_count++;
    }

    echo '<div class="wrap">';
    echo '<h1>漫画事例 管理ツール</h1>';

    // 重複警告
    if ($dup_count > 0) {
        echo '<div class="notice notice-error"><p>⚠️ <strong>' . $dup_count . ' 件の重複</strong>が検出されました。修復ボタンで古い方を削除できます。</p></div>';
        echo '<form method="post" style="margin-bottom:16px;">';
        wp_nonce_field('cxcms_import');
        echo '<button type="submit" name="cxcms_fix_duplicates" class="button" style="color:#d63638;border-color:#d63638;">重複を修復（古い方を削除）</button>';
        echo '</form>';
    } else {
        echo '<p>✅ 重複はありません。</p>';
    }

    // WP投稿一覧
    echo '<h2>登録済み漫画事例 (' . count($existing_map) . '件)</h2>';
    echo '<table class="widefat striped" style="max-width:800px;"><thead><tr><th>ID</th><th>タイトル</th><th>Hero</th><th>書庫</th><th>BM事例</th><th>ギャラリー</th></tr></thead><tbody>';
    foreach ($existing_map as $wid => $pids) {
        $pid = $pids[0];
        $title = get_the_title($pid);
        $hero_site = get_post_meta($pid, 'cx_show_hero_site', true) ?: 'both';
        $lib = get_post_meta($pid, 'cx_show_library', true) !== '0' ? '✅' : '—';
        $site = get_post_meta($pid, 'cx_show_site', true);
        $site_label = ($site === 'contentsx') ? '—' : '✅';
        $hero_labels = ['both'=>'両方','bizmanga'=>'BM','contentsx'=>'CX','none'=>'—'];
        $gal = get_post_meta($pid, 'cx_gallery', true);
        $gal_count = $gal ? count(array_filter(explode(',', $gal))) : 0;
        $gal_text = $gal_count > 0 ? '🖼 ' . $gal_count . '枚' : '—';
        $dup = count($pids) > 1 ? ' <span style="color:#d63638;">⚠️重複×' . count($pids) . '</span>' : '';
        echo '<tr><td>' . esc_html($wid) . '</td><td>' . esc_html($title) . $dup . '</td><td>' . ($hero_labels[$hero_site] ?? '両方') . '</td><td>' . $lib . '</td><td>' . $site_label . '</td><td>' . $gal_text . '</td></tr>';
    }
    echo '</tbody></table>';

    // ===== フォールバックJSエクスポート =====
    echo '<hr style="margin:32px 0;">';
    echo '<h2>フォールバックJS エクスポート</h2>';
    echo '<p>WPの現在のデータからフォールバック用JSコードを生成します。コピーして各JSファイルに貼り付けてください。</p>';

    // WP投稿からフォールバックデータ生成
    $all_posts = get_posts(['post_type'=>'manga_work','posts_per_page'=>200,'post_status'=>'publish','orderby'=>'meta_value_num','meta_key'=>'cx_sort_order','order'=>'ASC']);

    // --- bm-hero.js 用 (Heroに表示する作品) ---
    $hero_items = [];
    foreach ($all_posts as $p) {
        $m = function($k) use ($p) { return get_post_meta($p->ID, $k, true); };
        $hero_site = $m('cx_show_hero_site') ?: ($m('cx_show_hero') !== '0' ? 'both' : 'none');
        if ($hero_site === 'none') continue;
        $media_raw = $m('cx_media');
        $media = $media_raw ? array_map('trim', explode(',', str_replace('、', ',', $media_raw))) : [];
        $hero_items[] = [
            'id' => $m('cx_work_id'), 'title_ja' => $p->post_title, 'pages' => (int)$m('cx_pages'),
            'category' => $m('cx_client') ? wp_get_object_terms($p->ID, 'manga_category', ['fields'=>'names'])[0] ?? '' : '',
            'media' => $media, 'spec' => ['pages' => $m('cx_spec_pages'), 'period' => $m('cx_spec_period')],
            'point' => $m('cx_point'), 'comment' => $m('cx_comment')
        ];
    }
    echo '<h3>bm-hero.js 用 (FALLBACK_WORKS)</h3>';
    echo '<textarea readonly style="width:100%;height:200px;font-family:monospace;font-size:12px;" onclick="this.select();">';
    echo 'var FALLBACK_WORKS = ' . json_encode($hero_items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . ';';
    echo '</textarea>';

    // --- works.js 用 (ビズ書庫に表示する作品) ---
    $library_items = [];
    foreach ($all_posts as $p) {
        $m = function($k) use ($p) { return get_post_meta($p->ID, $k, true); };
        if ($m('cx_show_library') === '0') continue;
        $wid = $m('cx_work_id');
        if (!$wid) continue;
        $library_items[$wid] = [
            'title' => $p->post_title, 'title_en' => $m('cx_title_en'),
            'pages' => (int)$m('cx_pages'),
            'path' => 'https://contentsx.jp/material/manga/' . $wid . '/',
            'tags' => wp_get_object_terms($p->ID, 'manga_category', ['fields'=>'names']),
            'category' => wp_get_object_terms($p->ID, 'manga_category', ['fields'=>'names'])[0] ?? '',
            'viewType' => 'spread'
        ];
    }
    echo '<h3>works.js 用 (FALLBACK_WORKS)</h3>';
    echo '<textarea readonly style="width:100%;height:200px;font-family:monospace;font-size:12px;" onclick="this.select();">';
    echo 'const FALLBACK_WORKS = ' . json_encode($library_items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . ';';
    echo '</textarea>';

    // --- bm-home.js 用 (ギャラリー新作) ---
    $new_items = [];
    foreach ($all_posts as $p) {
        $m = function($k) use ($p) { return get_post_meta($p->ID, $k, true); };
        $wid = $m('cx_work_id');
        if (!$wid) continue;
        $new_items[] = [
            'id' => $wid, 'title_ja' => $p->post_title, 'title_en' => $m('cx_title_en'),
            'pages' => (int)$m('cx_pages'), 'added' => $m('cx_added_date') ?: $p->post_date
        ];
    }
    echo '<h3>bm-home.js 用 (FALLBACK_NEW_WORKS)</h3>';
    echo '<textarea readonly style="width:100%;height:200px;font-family:monospace;font-size:12px;" onclick="this.select();">';
    echo 'var FALLBACK_NEW_WORKS = ' . json_encode($new_items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . ';';
    echo '</textarea>';

    echo '<p style="margin-top:12px;color:#666;">※ クリックで全選択 → コピーして該当JSファイルのフォールバックデータを置き換えてください</p>';

    echo '</div>';
}

/* 共通: メタデータを投稿に書き込む */
function cxcms_write_meta( $post_id, $w, $sort_order ) {
    $media_str = is_array($w['media']) ? implode(', ', $w['media']) : $w['media'];
    update_post_meta($post_id, 'cx_work_id', $w['id']);
    update_post_meta($post_id, 'cx_title_en', $w['title_en']);
    update_post_meta($post_id, 'cx_pages', $w['pages']);
    update_post_meta($post_id, 'cx_client', $w['client']);
    update_post_meta($post_id, 'cx_spec_pages', $w['spec_pages']);
    update_post_meta($post_id, 'cx_spec_period', $w['spec_period']);
    update_post_meta($post_id, 'cx_media', $media_str);
    update_post_meta($post_id, 'cx_point', $w['point']);
    update_post_meta($post_id, 'cx_comment', $w['comment']);
    update_post_meta($post_id, 'cx_sort_order', $sort_order);

    // カテゴリ登録
    if (!empty($w['category'])) {
        $term = term_exists($w['category'], 'manga_category');
        if (!$term) $term = wp_insert_term($w['category'], 'manga_category');
        if (!is_wp_error($term)) {
            $term_id = is_array($term) ? $term['term_id'] : $term;
            wp_set_object_terms($post_id, [(int)$term_id], 'manga_category');
        }
    }
}

/* 共通: 外部画像URLをWPメディアにインポートしてattachment IDを返す */
function cxcms_import_image_from_url( $url, $post_id = 0 ) {
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    $tmp = download_url( $url, 30 );
    if ( is_wp_error($tmp) ) return 0;

    $fname = basename( parse_url($url, PHP_URL_PATH) );
    $file_array = [ 'name' => $fname, 'tmp_name' => $tmp ];
    $att_id = media_handle_sideload( $file_array, $post_id );
    if ( is_wp_error($att_id) ) {
        @unlink($tmp);
        return 0;
    }
    return $att_id;
}

/* 共通: ギャラリー画像をcontentsx.jpから取得してWPメディアに登録 */
function cxcms_import_gallery( $post_id, $work_id, $pages ) {
    $base = 'https://contentsx.jp/material/manga/' . $work_id . '/';
    $att_ids = [];
    for ($i = 1; $i <= $pages; $i++) {
        $url = $base . str_pad($i, 2, '0', STR_PAD_LEFT) . '.webp';
        $att_id = cxcms_import_image_from_url($url, $post_id);
        if ($att_id) $att_ids[] = $att_id;
    }
    if (!empty($att_ids)) {
        update_post_meta($post_id, 'cx_gallery', implode(',', $att_ids));
        // 1枚目をアイキャッチに設定
        set_post_thumbnail($post_id, $att_ids[0]);
    }
    return count($att_ids);
}

/* cx_work_id → post_id のマップを取得 */
function cxcms_get_existing_map() {
    $existing = get_posts(['post_type'=>'manga_work','posts_per_page'=>200,'post_status'=>'any','fields'=>'ids']);
    $map = [];
    foreach ($existing as $pid) {
        $wid = get_post_meta($pid, 'cx_work_id', true);
        if ($wid) {
            if (!isset($map[$wid])) $map[$wid] = [];
            $map[$wid][] = $pid;
        }
    }
    // タイトルでもチェック（cx_work_idが空の投稿を検出）
    foreach ($existing as $pid) {
        $wid = get_post_meta($pid, 'cx_work_id', true);
        if (empty($wid)) {
            $title = get_the_title($pid);
            if ($title) {
                // フォールバックデータとタイトル照合
                foreach (cxcms_get_import_data() as $w) {
                    if ($w['title_ja'] === $title && !isset($map[$w['id']])) {
                        // cx_work_idを補完
                        update_post_meta($pid, 'cx_work_id', $w['id']);
                        $map[$w['id']] = [$pid];
                        break;
                    }
                }
            }
        }
    }
    return $map;
}

/* cxcms_run_import / cxcms_run_sync は削除済み（WP管理画面から手動追加に移行） */

/* 重複修復（同じcx_work_idの投稿が複数ある場合、古い方を削除） */
function cxcms_fix_duplicates() {
    $existing_map = cxcms_get_existing_map();
    $deleted = 0;
    foreach ($existing_map as $wid => $pids) {
        if (count($pids) <= 1) continue;
        // 最新（最大のpost_id）を残し、他を削除
        rsort($pids);
        $keep = array_shift($pids);
        foreach ($pids as $dup_pid) {
            wp_delete_post($dup_pid, true); // 完全削除（ゴミ箱に入れない）
            $deleted++;
        }
    }
    return $deleted > 0
        ? $deleted . ' 件の重複投稿を削除しました'
        : '重複はありませんでした';
}

function cxcms_get_import_data() {
    return [
        ['id'=>'ichinohe-home','title_ja'=>'一戸ホーム','title_en'=>'Ichinohe Home','pages'=>22,'category'=>'営業','client'=>'一戸ホーム','media'=>['営業ツール','Web掲載'],'spec_pages'=>'22P','spec_period'=>'3週間','point'=>'住宅メーカーの魅力をストーリー漫画で伝える営業ツール。漫画ならではの没入感で、お客様の理解と共感を引き出します。','comment'=>'漫画にしたことで、お客様との商談がスムーズになりました。紙面だけでは伝わらなかった住まいへの想いが伝わるようになったと感じています。'],
        ['id'=>'diamond','title_ja'=>'DIAMOND シャンパンコール','title_en'=>'DIAMOND Champagne Call','pages'=>11,'category'=>'研修','client'=>'DIAMOND','media'=>['新人研修資料','マニュアル動画内'],'spec_pages'=>'9P','spec_period'=>'10日間','point'=>'新人が体験しがちな"焦りとミス"をストーリー化することで、正しい順序を守る大切さを体験として理解できる構成にしました。','comment'=>'これまで"何度言っても同じミスをする"新人が多かったのですが、漫画にしてから"自分も同じことをしそう"と感じてもらえるようになりました。'],
        ['id'=>'omatome-ninja','title_ja'=>'おまとめ忍者 見つけてみせる！トレンドの兆し','title_en'=>'Omatome Ninja: Discovering Trend Signs','pages'=>15,'category'=>'紹介','client'=>'マクニカ','media'=>['営業資料','Webサイト（製品紹介ページ）','SNS（X・Instagram）','社内説明・営業研修'],'spec_pages'=>'15P','spec_period'=>'10日間','point'=>'専門的なAI分析の説明を、"数字ではなく人の物語"に置き換え、"なるほど、こう使えるのか"とイメージできる構成にしました。','comment'=>'堅かった"データ分析の説明"が、漫画を通して"現場の悩み"として伝わるようになりました。会議でも"うちもこういう状況あるよね"と共感され、導入への理解が一気に進みました。'],
        ['id'=>'omatome-ninja-2','title_ja'=>'おまとめ忍者 手間な議事録をこっそり要約','title_en'=>'Omatome Ninja: Secretly Summarizing Meeting Notes','pages'=>15,'category'=>'紹介','client'=>'マクニカ','media'=>['営業資料（PDF／展示会パネル）','Webサイト（製品紹介ページ）','セミナー・展示会・SNS投稿'],'spec_pages'=>'15P','spec_period'=>'10日間','point'=>'"難しそう"を"かわいい・簡単そう"に変換し、AIツールの概念を直感で理解させる構成。','comment'=>'AIやDXのように専門的なサービスも、"忍者が助けてくれる"という比喩で、誰にでも理解してもらえるようになりました。'],
        ['id'=>'omatome-ninja-3','title_ja'=>'おまとめ忍者 地獄のまとめ作業 拙者におまかせ！','title_en'=>'Omatome Ninja: Leave the Tedious Summarizing to Me!','pages'=>15,'category'=>'紹介','client'=>'マクニカ','media'=>['展示会ブース配布用冊子','営業用資料','Webサイト／SNS（Instagram投稿・X）','セミナーやオンライン説明会での導入動画内使用'],'spec_pages'=>'15P','spec_period'=>'10日間','point'=>'"DX＝難しい"という印象を払拭し、明るく親しみのあるコミュニケーションを狙った構成。','comment'=>'説明しづらかったAIの価値が"誰でもわかる"漫画になったことで、展示会での会話率が格段に上がりました。'],
        ['id'=>'omatome-ninja-4','title_ja'=>'おまとめ忍者 手書き派の悩み 拙者にお任せ！','title_en'=>'Omatome Ninja: Helping the Handwriting Fans!','pages'=>15,'category'=>'紹介','client'=>'マクニカ','media'=>['営業資料','展示会／セミナー配布用冊子','Webサイト・SNS投稿（X・Instagram）','社内説明資料／製品紹介動画内'],'spec_pages'=>'15P','spec_period'=>'10日間','point'=>'商品サービスの仕組みを説明するのではなく、"現場でどんな変化が起きるか"を体感的に理解できる構成にしました。','comment'=>'"手書き派の社員でも使える"というポイントを、言葉ではなく漫画で伝えられたことで、現場担当者からの理解が格段に早くなりました。'],
        ['id'=>'omatome-ninja-5','title_ja'=>'おまとめ忍者 長時間会議も怖くない！','title_en'=>'Omatome Ninja: No More Fear of Long Meetings!','pages'=>15,'category'=>'紹介','client'=>'マクニカ','media'=>['展示会ブース配布冊子','営業資料（PDF）','Webサイト（製品紹介ページ）','SNS（X・Instagram）'],'spec_pages'=>'15P','spec_period'=>'10日間','point'=>'長い会議のストレスをリアルに描き、サービス導入後に"仕事が軽くなる感覚"を物語で表現。','comment'=>'"AI議事録"という言葉の説明より、漫画を見せる方が早い。経営層にも、"こういうことか！"とすぐ伝わるようになりました。'],
        ['id'=>'omatome-ninja-rohto','title_ja'=>'おまとめ忍者 忍者参上！！欠席者をお助けいたす！','title_en'=>'Omatome Ninja: Here to Help Absentees!','pages'=>15,'category'=>'紹介','client'=>'マクニカ','media'=>['営業資料','Webサイト（製品紹介ページ）','SNS（X・Instagram）'],'spec_pages'=>'15P','spec_period'=>'10日間','point'=>'体調不良や欠席など、"誰にでも起こる日常"を題材にすることで、AIの便利さを"助けてもらう安心感"として自然に伝える構成にしました。','comment'=>'商談でも"この漫画みたいなシーンあります！"と共感の声を多くいただきました。'],
        ['id'=>'omatome-ninja-english','title_ja'=>'おまとめ忍者（海外版）','title_en'=>'Omatome Ninja (Global Edition)','pages'=>15,'category'=>'紹介','client'=>'マクニカ','media'=>['グローバル展示会／海外パートナー企業への営業資料','Webサイト（英語版製品ページ）','SNS（LinkedIn・Instagram・X）','英語圏メディア向け紹介動画内素材'],'spec_pages'=>'15P','spec_period'=>'18日間','point'=>'英語版では、文化や言葉の違いを意識して、セリフやテンポをより自然なリズムに調整。国や文化が違っても、ビジュアルと物語の流れを追うだけで価値が伝わるストーリーに仕上げています。','comment'=>'海外の展示会で、漫画を見せると目立ち、人だかりができました。言葉で説明するよりも、物語で"価値のイメージ"を共有できるのが最大のメリットです。漫画は、日本のサービスが海外に出ていくうえでも強力な武器になると感じました。'],
        ['id'=>'seko','title_ja'=>'瀬古恭介 始まりのものがたり','title_en'=>'Kyosuke Seko: A Story of Beginnings','pages'=>25,'category'=>'ブランド','client'=>'瀬古','media'=>['ブランディング','Web掲載'],'spec_pages'=>'25P','spec_period'=>'4週間','point'=>'経営者の原体験と想いをストーリー漫画化。感情に訴える構成で、企業理念への深い理解と共感を生み出します。','comment'=>'自分の想いがこんなに伝わる形になるとは思いませんでした。社員にも読んでもらい、チームの結束が強まりました。'],
        ['id'=>'life-buzfes','title_ja'=>'バズフェス','title_en'=>'BuzzFes','pages'=>25,'category'=>'集客','client'=>'ライフエンターテイメント','media'=>['イベント告知','SNS広告'],'spec_pages'=>'25P','spec_period'=>'3週間','point'=>'イベントの魅力と参加メリットをストーリー形式で訴求。ターゲットの"自分ごと化"を促す構成で集客力を最大化。','comment'=>'漫画広告を使った告知で、前回比150%の集客を達成できました。'],
        ['id'=>'life-school','title_ja'=>'バズスクール','title_en'=>'Buzz School','pages'=>26,'category'=>'集客','client'=>'ライフエンターテイメント','media'=>['LP','SNS投稿'],'spec_pages'=>'26P','spec_period'=>'3週間','point'=>'スクールの魅力と卒業生の成功体験をストーリーで伝達。入学への不安を解消し、申込みへの心理的ハードルを下げる構成。','comment'=>'漫画を導入してから、LPからの問い合わせ率が大幅に改善しました。'],
        ['id'=>'bms-unso-remake','title_ja'=>'BMS運送','title_en'=>'BMS Transport','pages'=>10,'category'=>'採用','client'=>'BMS運送','media'=>['採用サイト','SNS'],'spec_pages'=>'10P','spec_period'=>'2週間','point'=>'初版の反響を踏まえ、よりターゲットに刺さるストーリーラインにリニューアル。キャラクターデザインも一新。','comment'=>'リメイク版は初版以上の反響で、スカウト返信率も向上しました。'],
        ['id'=>'kyoiku-manual','title_ja'=>'教育マニュアル','title_en'=>'Education Manual','pages'=>10,'category'=>'研修','client'=>'企業研修','media'=>['社内研修','マニュアル'],'spec_pages'=>'10P','spec_period'=>'2週間','point'=>'テキストだけでは伝わらない業務手順を、漫画でビジュアル化。新人の理解速度と定着率を大幅に向上させます。','comment'=>'研修時間が短縮され、新人の理解度テストのスコアも向上しました。'],
        ['id'=>'merumaga','title_ja'=>'メルマガ漫画','title_en'=>'Newsletter Manga','pages'=>10,'category'=>'集客','client'=>'メルマガ施策','media'=>['メールマガジン','Web掲載'],'spec_pages'=>'10P','spec_period'=>'10日間','point'=>'メルマガの開封率・クリック率を漫画コンテンツで劇的に改善。読者の「続きが読みたい」心理を活用した連載型。','comment'=>'開封率が平均の2倍以上になり、CVRも大幅に改善しました。'],
        ['id'=>'shohin-shokai','title_ja'=>'商品紹介漫画','title_en'=>'Product Introduction','pages'=>11,'category'=>'営業','client'=>'商品紹介','media'=>['LP','営業資料'],'spec_pages'=>'11P','spec_period'=>'2週間','point'=>'複雑な商品特徴を、ユーザー目線のストーリーで分かりやすく伝達。購買までの心理プロセスを漫画で設計。','comment'=>'商品の良さが直感的に伝わるようになり、商談の成約率が上がりました。'],
        ['id'=>'tagengo','title_ja'=>'多言語対応マニュアル','title_en'=>'Multilingual Manual','pages'=>12,'category'=>'研修','client'=>'多言語対応','media'=>['社内マニュアル','多言語展開'],'spec_pages'=>'12P','spec_period'=>'3週間','point'=>'外国人従業員向けに、言語の壁を超えるビジュアルマニュアルを漫画で実現。文化的配慮も盛り込んだ構成。','comment'=>'言葉が通じない場面でも、漫画なら伝わる。現場の安全意識が向上しました。'],
        ['id'=>'sixtones','title_ja'=>'SixTONES風キャラ','title_en'=>'SixTONES-style Characters','pages'=>4,'category'=>'IP','client'=>'IPキャラクター','media'=>['キャラクターデザイン','SNS'],'spec_pages'=>'4P','spec_period'=>'1週間','point'=>'著名人をモチーフにしたオリジナルキャラクターデザイン。IP展開を見据えた設計で、グッズ化・メディアミックスに対応。','comment'=>'キャラクターの完成度が高く、ファンからの反響も大きかったです。'],
        ['id'=>'torutoru-kun','title_ja'=>'トルトルくん','title_en'=>'Torutoru-kun','pages'=>21,'category'=>'採用','client'=>'トルトルくん','media'=>['採用ツール','Web掲載'],'spec_pages'=>'21P','spec_period'=>'3週間','point'=>'定額制採用代行・RPOサービス「トルトルくん」の魅力を漫画で訴求。月10万円から採用を再起動できる手軽さをストーリーで伝達。','comment'=>'漫画にしたことでサービスの分かりやすさが格段に上がり、問い合わせ数が増加しました。'],
        ['id'=>'hamada-masatada','title_ja'=>'濱田将匡 信頼を、つなぐ。','title_en'=>'Masatada Hamada: Connecting Trust','pages'=>20,'category'=>'ブランド','client'=>'FRESH CAREER','media'=>['ブランディング','Web掲載'],'spec_pages'=>'20P','spec_period'=>'4週間','point'=>'FRESH CAREER代表・濱田将匡氏の原体験と経営理念をストーリー漫画化。信頼をつなぐ想いを感情に訴える構成で表現。','comment'=>'自分のストーリーがここまで伝わる形になるとは思いませんでした。採用候補者にも好評です。'],
        ['id'=>'asobi-kyary','title_ja'=>'ASOBI SYSTEM×きゃりーぱみゅぱみゅ','title_en'=>'ASOBI SYSTEM x Kyary Pamyu Pamyu','pages'=>6,'category'=>'IP','client'=>'ASOBI SYSTEM','media'=>['提案資料','SNS'],'spec_pages'=>'6P','spec_period'=>'1週間','point'=>'ASOBI SYSTEMとの共同企画。きゃりーぱみゅぱみゅをモチーフにしたキャラクター漫画で、IPコラボレーションの可能性を提案。','comment'=>'キャラクターの魅力が漫画で十分に表現されており、コラボ企画の説得力が増しました。'],
        ['id'=>'uike-law','title_ja'=>'正義の価値','title_en'=>'The Value of Justice','pages'=>8,'category'=>'ブランド','client'=>'鵜池航太','media'=>['ブランディング','Webサイト'],'spec_pages'=>'8P','spec_period'=>'3週間','point'=>'弁護士の原体験と信念をWebtoon形式のストーリー漫画で表現。感情に訴える構成で、人となりへの深い理解と共感を生み出します。','comment'=>''],
        ['id'=>'lady-column','title_ja'=>'レディーコラム','title_en'=>'Lady Column','pages'=>8,'category'=>'紹介','client'=>'レディーコラム','media'=>['Webサイト','SNS'],'spec_pages'=>'8P','spec_period'=>'2週間','point'=>'女性向けコラムの魅力を漫画で表現。読者の共感と興味を引き出すストーリー構成。','comment'=>''],
    ];
}


/* ==========================================================
   お客様の声 API コールバック
   ========================================================== */

/* 一覧 */
function cxcms_api_testimonials( $request ) {
    $site = $request->get_param('site') ?: 'bizmanga';

    $posts = get_posts([
        'post_type'      => 'cx_testimonial',
        'posts_per_page' => 50,
        'post_status'    => 'publish',
        'meta_key'       => 'cx_testimonial_order',
        'orderby'        => 'meta_value_num',
        'order'          => 'ASC',
    ]);

    $items = [];
    foreach ( $posts as $p ) {
        $show_site = get_post_meta( $p->ID, 'cx_testimonial_show_site', true ) ?: 'both';
        if ( $show_site !== 'both' && $show_site !== $site ) continue;

        $items[] = cxcms_format_testimonial( $p );
    }

    return rest_ensure_response( $items );
}

/* お客様の声フォーマット共通 */
function cxcms_format_testimonial( $p ) {
    $m = function( $key ) use ( $p ) {
        return get_post_meta( $p->ID, $key, true );
    };

    $thumb_url = '';
    $thumb_id = get_post_thumbnail_id( $p->ID );
    if ( $thumb_id ) {
        $thumb_url = wp_get_attachment_url( $thumb_id );
    }

    $tag    = $m('cx_testimonial_tag') ?: '';
    $tag_en = $m('cx_testimonial_tag_en') ?: '';

    return [
        'id'             => $p->ID,
        'heading'        => $m('cx_testimonial_heading') ?: $p->post_title,
        'heading_en'     => $m('cx_testimonial_heading_en') ?: '',
        'excerpt'        => $m('cx_testimonial_excerpt') ?: '',
        'excerpt_en'     => $m('cx_testimonial_excerpt_en') ?: '',
        'thumbnail'      => $thumb_url,
        'img_position'   => $m('cx_testimonial_img_position') ?: 'center',
        'tag'            => $tag,
        'tag_en'         => $tag_en,
        'order'          => (int)( $m('cx_testimonial_order') ?: 10 ),
    ];
}

/* 個別（本文含む） */
function cxcms_api_testimonial_single( $request ) {
    $post = get_post( (int) $request['id'] );
    if ( ! $post || $post->post_type !== 'cx_testimonial' || $post->post_status !== 'publish' ) {
        return new WP_Error( 'not_found', 'Testimonial not found', [ 'status' => 404 ] );
    }

    $data = cxcms_format_testimonial( $post );
    $data['content'] = apply_filters( 'the_content', $post->post_content );

    return rest_ensure_response( $data );
}

/* ============================================================
   コラム (cx_column) — 2026-04-16 追加
   BizManga / ContentsX の知識発信ブログ
   ============================================================ */

/* ── カスタム投稿タイプ登録 ── */
add_action( 'init', 'cxcms_register_column_cpt' );
function cxcms_register_column_cpt() {
    register_post_type( 'cx_column', [
        'labels' => [
            'name'               => 'コラム',
            'singular_name'      => 'コラム',
            'add_new'            => '新規追加',
            'add_new_item'       => 'コラムを追加',
            'edit_item'          => 'コラムを編集',
            'all_items'          => 'すべてのコラム',
            'search_items'       => 'コラムを検索',
            'not_found'          => 'コラムが見つかりません',
        ],
        'public'       => true,
        'publicly_queryable' => true,
        'show_ui'      => true,
        'show_in_rest' => true,
        'rest_base'    => 'cx-columns',
        'menu_icon'    => 'dashicons-edit',
        'supports'     => [ 'title', 'editor', 'thumbnail', 'excerpt', 'slug' ],
        'has_archive'  => false,
        'rewrite'      => false,
    ]);

    /* ── コラムカテゴリ ── */
    register_taxonomy( 'column_category', 'cx_column', [
        'labels' => [
            'name'          => 'カテゴリ',
            'singular_name' => 'カテゴリ',
            'add_new_item'  => 'カテゴリを追加',
        ],
        'show_in_rest'      => true,
        'rest_base'         => 'column-categories',
        'hierarchical'      => true,
        'show_ui'           => true,
        'show_admin_column' => true,
    ]);
}

/* ── コラム メタボックス ── */
add_action( 'add_meta_boxes', function() {
    add_meta_box( 'cx_column_fields', 'コラム詳細', 'cxcms_column_meta_html', 'cx_column', 'normal', 'high' );
});

function cxcms_column_meta_html( $post ) {
    wp_nonce_field( 'cxcms_column_save', 'cxcms_column_nonce' );
    $m = fn($k) => get_post_meta( $post->ID, $k, true );
    ?>
    <style>.cx-field{margin:10px 0}.cx-field label{display:block;font-weight:700;margin-bottom:4px}.cx-field input,.cx-field textarea{width:100%;padding:6px 8px;box-sizing:border-box}.cx-field textarea{min-height:120px;font-family:inherit}.cx-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cx-hint{color:#666;font-size:12px;margin-top:2px}</style>
    <div class="cx-row">
        <div class="cx-field">
            <label>タイトル（英語）</label>
            <input name="cx_column_title_en" value="<?php echo esc_attr($m('cx_column_title_en')); ?>">
        </div>
        <div class="cx-field">
            <label>表示先サイト</label>
            <div style="padding:6px 0"><?php cxcms_show_site_checkboxes_html( 'cx_column_show_site', $m('cx_column_show_site') ); ?></div>
            <div class="cx-hint">チェックなし＝どこにも表示しない</div>
        </div>
    </div>
    <div class="cx-field">
        <label>抜粋（日本語）</label>
        <textarea name="cx_column_excerpt_ja" placeholder="カード表示用の短い説明文。空欄なら本文冒頭から自動抽出"><?php echo esc_textarea($m('cx_column_excerpt_ja')); ?></textarea>
        <div class="cx-hint">カードに表示される120文字程度の要約。空欄で本文から自動抽出。</div>
    </div>
    <div class="cx-field">
        <label>抜粋（英語）</label>
        <textarea name="cx_column_excerpt_en" placeholder="Short description for the card"><?php echo esc_textarea($m('cx_column_excerpt_en')); ?></textarea>
    </div>
    <div class="cx-field">
        <label>本文（英語）</label>
        <textarea name="cx_column_content_en" style="min-height:240px" placeholder="Leave blank to show Japanese content even in English mode."><?php echo esc_textarea($m('cx_column_content_en')); ?></textarea>
        <div class="cx-hint">HTMLタグ使用可。空欄なら英語表示時も日本語本文が表示されます。</div>
    </div>
    <div class="cx-field">
        <label style="display:inline-flex;align-items:center;gap:8px">
            <input type="hidden" name="cx_column_pickup_present" value="1">
            <input type="checkbox" name="cx_column_pickup" value="1" <?php checked( $m('cx_column_pickup') === '1' ); ?> style="width:auto;margin:0"> 注目記事（一覧のPICK UP枠に表示）
        </label>
        <div class="cx-hint">コラム一覧トップに大きく掲載（複数チェック時は最新）。イチオシ採用のコラム面で使用。</div>
    </div>
    <div class="cx-field">
        <label>SEOタイトル</label>
        <input name="cx_column_seo_title" value="<?php echo esc_attr($m('cx_column_seo_title')); ?>" placeholder="空欄＝記事タイトルを使用">
        <div class="cx-hint">検索結果に出るタイトル（30〜35字目安）。空欄なら記事タイトルを使用。</div>
    </div>
    <div class="cx-field">
        <label>SEO説明文</label>
        <textarea name="cx_column_seo_description" style="min-height:60px" placeholder="空欄＝抜粋を使用"><?php echo esc_textarea($m('cx_column_seo_description')); ?></textarea>
        <div class="cx-hint">検索結果の説明文（120字目安）。空欄なら抜粋を使用。</div>
    </div>
    <p class="cx-hint">※ サムネイル画像は右サイドバーの「アイキャッチ画像」から設定してください（推奨 1200×630）。カテゴリは右サイドバーの「カテゴリ」から選択。</p>
    <?php
}

/* ── コラム保存 ── */
add_action( 'save_post_cx_column', 'cxcms_save_column_meta' );
function cxcms_save_column_meta( $post_id ) {
    if ( ! isset($_POST['cxcms_column_nonce']) || ! wp_verify_nonce($_POST['cxcms_column_nonce'], 'cxcms_column_save') ) return;
    if ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) return;
    if ( ! current_user_can( 'edit_post', $post_id ) ) return;
    /* 掲載先（チェックボックス複数）。nonce検証済みのため未チェック＝意図的な非表示 */
    update_post_meta( $post_id, 'cx_column_show_site', cxcms_sanitize_show_site_post( $_POST['cx_column_show_site'] ?? [] ) );
    /* 注目（PICK UP）チェック。present hidden があるときだけ未チェック=0 と判定 */
    if ( isset($_POST['cx_column_pickup_present']) ) {
        update_post_meta( $post_id, 'cx_column_pickup', isset($_POST['cx_column_pickup']) ? '1' : '0' );
    }
    $fields = ['cx_column_title_en','cx_column_seo_title'];
    foreach ( $fields as $f ) {
        if ( isset($_POST[$f]) ) update_post_meta( $post_id, $f, sanitize_text_field($_POST[$f]) );
    }
    $text_fields = ['cx_column_excerpt_ja','cx_column_excerpt_en','cx_column_seo_description'];
    foreach ( $text_fields as $f ) {
        if ( isset($_POST[$f]) ) update_post_meta( $post_id, $f, sanitize_textarea_field($_POST[$f]) );
    }
    if ( isset($_POST['cx_column_content_en']) ) {
        update_post_meta( $post_id, 'cx_column_content_en', wp_kses_post($_POST['cx_column_content_en']) );
    }
}

/* ── コラム管理画面カスタム列 ── */
add_filter( 'manage_cx_column_posts_columns', function( $cols ) {
    $new = [];
    foreach ( $cols as $k => $v ) {
        $new[$k] = $v;
        if ( $k === 'title' ) {
            $new['cx_col_thumb'] = '表紙';
            $new['cx_col_en']    = 'EN';
            $new['cx_col_site']  = 'サイト';
        }
    }
    return $new;
});
add_action( 'manage_cx_column_posts_custom_column', function( $col, $post_id ) {
    if ( $col === 'cx_col_thumb' ) {
        $thumb_id = get_post_thumbnail_id( $post_id );
        if ( $thumb_id ) {
            $img = wp_get_attachment_image_src( $thumb_id, 'thumbnail' );
            if ( $img ) echo '<img src="' . esc_url($img[0]) . '" style="width:60px;height:34px;object-fit:cover;border-radius:3px">';
        } else echo '<span style="color:#bbb">—</span>';
    }
    if ( $col === 'cx_col_en' ) {
        $t = get_post_meta( $post_id, 'cx_column_title_en', true );
        $c = get_post_meta( $post_id, 'cx_column_content_en', true );
        echo ($t && $c) ? '<span style="color:#2ecc71;font-size:16px">✓</span>' : '<span style="color:#bbb">—</span>';
    }
    if ( $col === 'cx_col_site' ) {
        echo esc_html( cxcms_show_site_label( get_post_meta( $post_id, 'cx_column_show_site', true ) ) );
    }
}, 10, 2 );

/* ── お客様の声 管理画面カスタム列 ── */
add_filter( 'manage_cx_testimonial_posts_columns', function( $cols ) {
    $new = [];
    foreach ( $cols as $k => $v ) {
        $new[$k] = $v;
        if ( $k === 'title' ) {
            $new['cx_tm_thumb'] = '写真';
            $new['cx_tm_site']  = 'サイト';
        }
    }
    return $new;
});
add_action( 'manage_cx_testimonial_posts_custom_column', function( $col, $post_id ) {
    if ( $col === 'cx_tm_thumb' ) {
        $thumb_id = get_post_thumbnail_id( $post_id );
        if ( $thumb_id ) {
            $img = wp_get_attachment_image_src( $thumb_id, 'thumbnail' );
            if ( $img ) echo '<img src="' . esc_url($img[0]) . '" style="width:60px;height:60px;object-fit:cover;border-radius:50%">';
        } else echo '<span style="color:#bbb">—</span>';
    }
    if ( $col === 'cx_tm_site' ) {
        $s = get_post_meta( $post_id, 'cx_testimonial_show_site', true ) ?: 'both';
        $labels = ['both' => '両方', 'bizmanga' => 'BM', 'contentsx' => 'CX'];
        echo esc_html( $labels[$s] ?? '両方' );
    }
}, 10, 2 );

/* ── REST フィールド公開 ── */
add_action( 'rest_api_init', function() {
    $column_fields = ['cx_column_title_en','cx_column_excerpt_ja','cx_column_excerpt_en','cx_column_show_site'];
    foreach ( $column_fields as $f ) {
        register_rest_field( 'cx_column', $f, [
            'get_callback' => fn($obj) => get_post_meta( $obj['id'], $f, true ),
            'schema'       => [ 'type' => 'string' ],
        ]);
    }
});

/* ── REST ルート ── */
add_action( 'rest_api_init', function() {
    register_rest_route( 'contentsx/v1', '/columns', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_columns',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route( 'contentsx/v1', '/columns/(?P<id>\d+)', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_column_single',
        'permission_callback' => '__return_true',
        'args' => [
            'id' => [ 'validate_callback' => function($v){return is_numeric($v);} ],
        ],
    ]);
    /* ── コラム プレビュー API（下書き/予約投稿を管理者のみ取得可能） ── */
    register_rest_route( 'contentsx/v1', '/columns/(?P<id>\d+)/preview', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_column_preview',
        'permission_callback' => 'cxcms_column_preview_permission',
        'args' => [
            'id' => [ 'validate_callback' => function($v){return is_numeric($v);} ],
        ],
    ]);
});

/* ── コラム整形ヘルパー ── */
function cxcms_format_column( $p ) {
    $m = fn($k) => get_post_meta( $p->ID, $k, true );

    /* カテゴリ（最初の1件） */
    $cat_ja = '';
    $terms = get_the_terms( $p->ID, 'column_category' );
    if ( $terms && ! is_wp_error($terms) ) {
        $cat_ja = $terms[0]->name;
    }

    /* アイキャッチ */
    $thumb_url = '';
    $thumb_id = get_post_thumbnail_id( $p->ID );
    if ( $thumb_id ) {
        $img = wp_get_attachment_image_src( $thumb_id, 'large' );
        if ( $img ) $thumb_url = $img[0];
    }

    /* 抜粋 — 明示抜粋 > the_excerpt > 本文冒頭 120 字 */
    $excerpt_ja = $m('cx_column_excerpt_ja') ?: '';
    if ( empty( $excerpt_ja ) ) {
        $excerpt_ja = has_excerpt( $p ) ? get_the_excerpt( $p ) : wp_trim_words( wp_strip_all_tags( $p->post_content ), 60, '…' );
    }

    return [
        'id'         => $p->ID,
        'slug'       => $p->post_name,
        'date'       => get_the_date( 'Y.m.d', $p ),
        'date_ymd'   => get_the_date( 'Y-m-d', $p ),
        'modified_ymd' => get_the_modified_date( 'Y-m-d', $p ),
        'category'   => $cat_ja,
        'title_ja'   => $p->post_title,
        'title_en'   => $m('cx_column_title_en') ?: '',
        'excerpt_ja' => $excerpt_ja,
        'excerpt_en' => $m('cx_column_excerpt_en') ?: '',
        'thumbnail'  => $thumb_url,
        'show_site'  => $m('cx_column_show_site') ?: 'both',
        /* ↓ 2026-06-15 追加（既存キーは不変・後方互換維持）。PICK UP / SEO は空ならフロント側でフォールバック */
        'pickup'         => $m('cx_column_pickup') === '1',
        'seo_title'      => $m('cx_column_seo_title') ?: '',
        'seo_description'=> $m('cx_column_seo_description') ?: '',
    ];
}

/* ── コラム一覧 API ── */
function cxcms_api_columns( $req ) {
    $limit = (int) ( $req->get_param('per_page') ?: 50 );
    $posts = get_posts([
        'post_type'      => 'cx_column',
        'posts_per_page' => min( $limit, 100 ),
        'orderby'        => 'date',
        'order'          => 'DESC',
        'post_status'    => 'publish',
    ]);
    $out = [];
    foreach ( $posts as $p ) {
        $out[] = cxcms_format_column( $p );
    }
    $out = cxcms_filter_by_site( $out, $req->get_param('site') );
    return rest_ensure_response( $out );
}

/* ── コラム個別 API ── */
function cxcms_api_column_single( $req ) {
    $post_id = (int) $req['id'];
    $p = get_post( $post_id );
    if ( ! $p || $p->post_type !== 'cx_column' || $p->post_status !== 'publish' ) {
        return new WP_Error( 'not_found', 'コラムが見つかりません', [ 'status' => 404 ] );
    }
    $data = cxcms_format_column( $p );
    $content = apply_filters( 'the_content', $p->post_content );
    $content_en_raw = get_post_meta( $p->ID, 'cx_column_content_en', true );
    $content_en = $content_en_raw ? apply_filters( 'the_content', $content_en_raw ) : '';
    $data['content']    = $content;
    $data['content_en'] = $content_en;
    return rest_ensure_response( $data );
}

/* ── コラム プレビュー: 下書き/予約投稿/非公開 全てを返す（権限チェック必須） ── */
function cxcms_column_preview_permission( $req ) {
    /* 管理画面ログイン（cx_column 編集権限あり）を必須にする */
    if ( ! is_user_logged_in() || ! current_user_can( 'edit_posts' ) ) {
        return new WP_Error( 'forbidden', 'プレビューには管理画面ログインが必要です', [ 'status' => 401 ] );
    }
    /* 管理画面側で発行したノンスを検証してCSRFを防ぐ */
    $nonce = $req->get_param('_wpnonce');
    if ( ! $nonce ) {
        $nonce = $req->get_header('x_wp_nonce');
    }
    if ( ! $nonce || ! wp_verify_nonce( $nonce, 'cxcms_preview_column_' . (int) $req['id'] ) ) {
        return new WP_Error( 'bad_nonce', 'nonce不正', [ 'status' => 403 ] );
    }
    return true;
}

function cxcms_api_column_preview( $req ) {
    $post_id = (int) $req['id'];
    $p = get_post( $post_id );
    if ( ! $p || $p->post_type !== 'cx_column' ) {
        return new WP_Error( 'not_found', 'コラムが見つかりません', [ 'status' => 404 ] );
    }
    /* 公開含めどのステータスでも返すが、ゴミ箱だけ除外 */
    if ( $p->post_status === 'trash' ) {
        return new WP_Error( 'trashed', 'ゴミ箱のコラムです', [ 'status' => 410 ] );
    }
    $data = cxcms_format_column( $p );
    /* 最新リビジョン（プレビュー用）を反映 */
    $preview = wp_get_post_autosave( $post_id );
    if ( $preview && $preview->post_modified > $p->post_modified ) {
        $raw_title = $preview->post_title;
        $raw_content = $preview->post_content;
        if ( $raw_title ) $data['title_ja'] = $raw_title;
    } else {
        $raw_content = $p->post_content;
    }
    $data['content']    = apply_filters( 'the_content', $raw_content );
    $content_en_raw     = get_post_meta( $p->ID, 'cx_column_content_en', true );
    $data['content_en'] = $content_en_raw ? apply_filters( 'the_content', $content_en_raw ) : '';
    $data['post_status'] = $p->post_status;
    $data['is_preview']  = true;
    return rest_ensure_response( $data );
}

/* ── 管理画面「プレビュー」ボタンをフロント側に向ける ── */
/* コラム詳細ページは BizManga 側にある。掲載先が「イチオシ採用」のみのコラムは
   ichioshi.contentsx.jp 側へ振り分ける（2026-06-15、2026-07-09ドメイン改名反映）。混在/B/C は従来通り BM へ。 */
add_filter( 'preview_post_link', function( $link, $post ) {
    if ( ! $post || $post->post_type !== 'cx_column' ) return $link;
    $sites = cxcms_show_site_list( get_post_meta( $post->ID, 'cx_column_show_site', true ) );
    $ichioshi_only = in_array( 'ichioshi', $sites, true )
        && ! in_array( 'bizmanga', $sites, true )
        && ! in_array( 'contentsx', $sites, true );
    $base = $ichioshi_only
        ? 'https://ichioshi.contentsx.jp/column-detail'
        : 'https://bizmanga.contentsx.jp/column-detail';
    $nonce = wp_create_nonce( 'cxcms_preview_column_' . $post->ID );
    return add_query_arg( [
        'id'      => $post->ID,
        'preview' => '1',
        '_wpnonce'=> $nonce,
    ], $base );
}, 10, 2 );


/* ============================================================
   イチオシ採用 採用事例 (rx_case) — 2026-06-12 追加、2026-07-09 リクルートXから改名
   ichioshi.contentsx.jp 専用CPT。親メニュー: cxcms-ichioshi (§1b)
   ※ CPT名 rx_case / タクソノミー rx_case_tag / メタキー rx_case_* は
     DB保存値と結合しているため旧名のまま維持（改名にはDB移行が必要）
   メイン画像 = アイキャッチ + フォーカルポイント(object-position %)
   実績数値 = 最大3ブロック可変(項目名/数値/単位/矢印) JSON保存
   詳細ページ本文 = 標準エディタ（コラムと同じ操作感）
   ============================================================ */

/* ── カスタム投稿タイプ・タクソノミー登録 ── */
add_action( 'init', 'cxcms_register_rx_case_cpt' );
function cxcms_register_rx_case_cpt() {
    register_post_type( 'rx_case', [
        'labels' => [
            'name'               => '採用事例',
            'singular_name'      => '採用事例',
            'add_new'            => '新規追加',
            'add_new_item'       => '採用事例を追加',
            'edit_item'          => '採用事例を編集',
            'all_items'          => 'すべての採用事例',
            'search_items'       => '採用事例を検索',
            'not_found'          => '採用事例が見つかりません',
            'featured_image'        => 'メイン画像（カード左側）',
            'set_featured_image'    => 'メイン画像を設定',
            'remove_featured_image' => 'メイン画像を削除',
            'use_featured_image'    => 'メイン画像として使用',
        ],
        'public'             => true,    // BUGS #004: スラッグ欄表示に必須
        'publicly_queryable' => true,
        'show_ui'            => true,
        'show_in_menu'       => 'cxcms-ichioshi',   // イチオシ採用専用 → 親メニュー配下
        'show_in_rest'       => true,
        'rest_base'          => 'rx-cases',
        'menu_icon'          => 'dashicons-businessperson',
        'supports'           => [ 'title', 'editor', 'thumbnail', 'slug' ],
        'has_archive'        => false,
        'rewrite'            => false,
    ]);

    /* ── 事例タグ（選択肢マスター。事例編集画面ではメタボックス内のチェックボックスで選ぶ） ── */
    register_taxonomy( 'rx_case_tag', 'rx_case', [
        'labels' => [
            'name'          => '事例タグ',
            'singular_name' => '事例タグ',
            'add_new_item'  => '事例タグを追加',
        ],
        'show_in_rest'      => false,  // タグ編集はメタボックス内に一本化（サイドバーパネルとの二重管理事故防止）
        'hierarchical'      => true,
        'show_ui'           => true,
        'meta_box_cb'       => false,  // クラシックエディタ時の標準メタボックスも出さない
        'show_admin_column' => true,
    ]);
}

/* ── タイトル欄プレースホルダーを会社名仕様に ── */
add_filter( 'enter_title_here', function( $text, $post ) {
    return $post->post_type === 'rx_case' ? '会社名（例: 株式会社トラム様）' : $text;
}, 10, 2 );

/* ── 採用事例 メタボックス ── */
add_action( 'add_meta_boxes', function() {
    add_meta_box( 'rx_case_fields', '採用事例 詳細', 'cxcms_rx_case_meta_html', 'rx_case', 'normal', 'high' );
});

function cxcms_rx_case_meta_html( $post ) {
    wp_nonce_field( 'cxcms_rx_case_save', 'cxcms_rx_case_nonce' );
    $m = fn($k) => get_post_meta( $post->ID, $k, true );

    $focal_x = $m('rx_case_focal_x');
    $focal_x = ( $focal_x === '' ) ? 50 : (float) $focal_x;
    $focal_y = $m('rx_case_focal_y');
    $focal_y = ( $focal_y === '' ) ? 50 : (float) $focal_y;

    $stats = json_decode( $m('rx_case_stats') ?: '[]', true );
    if ( ! is_array( $stats ) ) $stats = [];
    /* 新規作成画面では定番の項目名・単位・矢印を自動充填（数値だけ入力すれば済むように） */
    if ( ! $stats && $post->post_status === 'auto-draft' ) {
        $stats = [
            [ 'label' => '応募数',   'value' => '', 'unit' => '名/月', 'arrow' => 'up'   ],
            [ 'label' => '応募単価', 'value' => '', 'unit' => '円',    'arrow' => 'down' ],
            [ 'label' => '採用単価', 'value' => '', 'unit' => '万円',  'arrow' => 'down' ],
        ];
    }

    $thumb_url = get_the_post_thumbnail_url( $post, 'large' ) ?: '';
    $arrow_options = [
        'none' => '表示しない',
        'up'   => '↗ 上向き（数値が上がった）',
        'down' => '↘ 下向き（単価などが下がった）',
    ];
    $stat_placeholders = [
        [ '応募数', '52', '倍' ],
        [ '採用数', '14', '名/月' ],
        [ '採用単価', '92', '%減' ],
    ];
    ?>
    <style>
        .rx-field{margin:14px 0}
        .rx-field>label{display:block;font-weight:700;margin-bottom:4px}
        .rx-field textarea{width:100%;min-height:80px;padding:6px 8px;box-sizing:border-box;font-family:inherit}
        .rx-hint{color:#666;font-size:12px;margin-top:4px}
        #rxFocalFrame{position:relative;width:280px;aspect-ratio:3/4;overflow:hidden;border:1px solid #ccd0d4;border-radius:6px;background:#f0f0f1;cursor:grab;touch-action:none;user-select:none;max-width:100%}
        #rxFocalFrame.is-sp{width:480px;aspect-ratio:16/7}
        #rxFocalFrame.is-dragging{cursor:grabbing}
        #rxFocalImg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;-webkit-user-drag:none}
        #rxFocalEmpty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#777;font-size:12px;padding:12px;text-align:center}
        #rxFocalCtrl{margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        #rxFocalReadout{color:#666;font-size:12px}
        .rx-stat-head,.rx-stat-row{display:grid;grid-template-columns:1.2fr 1fr 1fr 1.6fr;gap:8px;margin-bottom:6px;align-items:center}
        .rx-stat-head{color:#666;font-size:12px;margin-bottom:2px}
        .rx-stat-row input,.rx-stat-row select{width:100%;padding:5px 8px;box-sizing:border-box}
        .rx-tag-list{display:flex;flex-wrap:wrap;gap:6px 18px;padding:4px 0}
        .rx-tag-list label{display:inline-flex;align-items:center;gap:5px;font-weight:400;white-space:nowrap}
        .rx-wide{width:100%;padding:6px 8px;box-sizing:border-box}
    </style>

    <div class="rx-field">
        <label>タグ（画像上のハッシュタグ）</label>
        <input type="hidden" name="rx_case_tags_present" value="1">
        <?php
        $all_tags = get_terms( [ 'taxonomy' => 'rx_case_tag', 'hide_empty' => false ] );
        $current_tag_ids = wp_get_object_terms( $post->ID, 'rx_case_tag', [ 'fields' => 'ids' ] );
        if ( is_wp_error( $current_tag_ids ) ) $current_tag_ids = [];
        if ( ! $all_tags || is_wp_error( $all_tags ) ) {
            echo '<div class="rx-hint">タグがまだ登録されていません。「イチオシ採用 &gt; 事例タグ」で選択肢を登録すると、ここにチェックボックスで並びます。</div>';
        } else {
            echo '<div class="rx-tag-list">';
            foreach ( $all_tags as $t ) {
                printf(
                    '<label><input type="checkbox" name="rx_case_tags[]" value="%d" %s> %s</label>',
                    (int) $t->term_id,
                    checked( in_array( (int) $t->term_id, $current_tag_ids, true ), true, false ),
                    esc_html( $t->name )
                );
            }
            echo '</div>';
            echo '<div class="rx-hint">選択肢の追加・名前変更は「イチオシ採用 &gt; 事例タグ」から。</div>';
        }
        ?>
    </div>

    <div class="rx-field">
        <label>成果の概要</label>
        <textarea name="rx_case_summary" placeholder="例: 6か月で2名だった採用が1か月で14名に。採用単価は150万円から12万円へ。"><?php echo esc_textarea( $m('rx_case_summary') ); ?></textarea>
        <div class="rx-hint">カードの会社名の下に表示される、成果のあらましを伝える説明文です。</div>
    </div>

    <div class="rx-field">
        <label>メイン画像の表示位置</label>
        <div id="rxFocalFrame">
            <img id="rxFocalImg" <?php if ( $thumb_url ) echo 'src="' . esc_url( $thumb_url ) . '"'; else echo 'style="display:none"'; ?> alt="">
            <div id="rxFocalEmpty" <?php if ( $thumb_url ) echo 'style="display:none"'; ?>>右側の「メイン画像（カード左側）」を設定するとプレビューが表示されます</div>
        </div>
        <div id="rxFocalCtrl">
            <button type="button" class="button" id="rxFocalRatio">スマホ比率で確認</button>
            <button type="button" class="button" id="rxFocalReset">中央に戻す</button>
            <span id="rxFocalReadout"></span>
        </div>
        <input type="hidden" name="rx_case_focal_x" id="rxFocalX" value="<?php echo esc_attr( $focal_x ); ?>">
        <input type="hidden" name="rx_case_focal_y" id="rxFocalY" value="<?php echo esc_attr( $focal_y ); ?>">
        <div class="rx-hint">プレビュー内の画像をドラッグして「どこを見せるか」を調整します。横長の画像は左右、縦長の画像は上下に動かせます。位置はPC・スマホ両方の表示に適用されます。</div>
    </div>

    <div class="rx-field">
        <label>実績の数値ブロック（最大3個）</label>
        <div class="rx-stat-head"><span>項目名</span><span>数値</span><span>単位</span><span>矢印アイコン</span></div>
        <?php for ( $i = 0; $i < 3; $i++ ) :
            $s = $stats[ $i ] ?? [ 'label' => '', 'value' => '', 'unit' => '', 'arrow' => 'none' ];
            $ph = $stat_placeholders[ $i ];
        ?>
        <div class="rx-stat-row">
            <input name="rx_case_stat_label[]" value="<?php echo esc_attr( $s['label'] ?? '' ); ?>" placeholder="例: <?php echo esc_attr( $ph[0] ); ?>">
            <input name="rx_case_stat_value[]" value="<?php echo esc_attr( $s['value'] ?? '' ); ?>" placeholder="例: <?php echo esc_attr( $ph[1] ); ?>">
            <input name="rx_case_stat_unit[]" value="<?php echo esc_attr( $s['unit'] ?? '' ); ?>" placeholder="例: <?php echo esc_attr( $ph[2] ); ?>">
            <select name="rx_case_stat_arrow[]">
                <?php foreach ( $arrow_options as $val => $label ) : ?>
                <option value="<?php echo esc_attr( $val ); ?>" <?php selected( $s['arrow'] ?? 'none', $val ); ?>><?php echo esc_html( $label ); ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <?php endfor; ?>
        <div class="rx-hint">項目名と数値の両方を入力したブロックだけがカードに表示されます（1〜3個可変）。項目名は「期間」「費用」など自由に変えられます。</div>
    </div>

    <div class="rx-field">
        <label>SEOタイトル（検索結果に出るタイトル）</label>
        <input class="rx-wide" name="rx_case_seo_title" value="<?php echo esc_attr( $m('rx_case_seo_title') ); ?>" placeholder="例: 飲食店の採用成功事例｜応募が月数名→ひと月82名に。原稿改善だけで達成">
        <div class="rx-hint">30字前後推奨。空欄の場合は「会社名の採用成功事例｜イチオシ採用」が自動で使われます。</div>
    </div>

    <div class="rx-field">
        <label>メタディスクリプション（検索結果の説明文）</label>
        <textarea name="rx_case_seo_description" placeholder="検索結果やSNSシェアで表示される説明文（120字前後推奨）"><?php echo esc_textarea( $m('rx_case_seo_description') ); ?></textarea>
        <div class="rx-hint">空欄の場合は「成果の概要」がそのまま使われます。</div>
    </div>

    <p class="rx-hint">※ 「詳しく見る」で開く詳細ページの中身は、上の本文エディタで編集します（コラムと同じ操作感）。詳細ページのURLは /case/スラッグ になるため、画面右の「スラッグ」欄に英数字を入力してください（例: tram）。</p>

    <script>
    (function(){
        var frame   = document.getElementById('rxFocalFrame'),
            img     = document.getElementById('rxFocalImg'),
            empty   = document.getElementById('rxFocalEmpty'),
            inX     = document.getElementById('rxFocalX'),
            inY     = document.getElementById('rxFocalY'),
            readout = document.getElementById('rxFocalReadout'),
            ratioBtn= document.getElementById('rxFocalRatio'),
            resetBtn= document.getElementById('rxFocalReset');
        if ( ! frame ) return;

        var fx = parseFloat(inX.value), fy = parseFloat(inY.value);
        if ( isNaN(fx) ) fx = 50;
        if ( isNaN(fy) ) fy = 50;

        function apply() {
            img.style.objectPosition = fx + '% ' + fy + '%';
            inX.value = fx.toFixed(1);
            inY.value = fy.toFixed(1);
            readout.textContent = '横 ' + Math.round(fx) + '% / 縦 ' + Math.round(fy) + '%';
        }
        function setImage( url ) {
            if ( url ) {
                img.src = url;
                img.style.display = '';
                empty.style.display = 'none';
            } else {
                img.removeAttribute('src');
                img.style.display = 'none';
                empty.style.display = '';
            }
        }

        /* ドラッグで object-position をパン（cover時のあふれ量に比例） */
        var dragging = false, sx = 0, sy = 0, sfx = 50, sfy = 50;
        frame.addEventListener('pointerdown', function(e){
            if ( ! img.getAttribute('src') ) return;
            dragging = true; sx = e.clientX; sy = e.clientY; sfx = fx; sfy = fy;
            frame.classList.add('is-dragging');
            frame.setPointerCapture(e.pointerId);
            e.preventDefault();
        });
        frame.addEventListener('pointermove', function(e){
            if ( ! dragging ) return;
            var fw = frame.clientWidth, fh = frame.clientHeight;
            var nw = img.naturalWidth, nh = img.naturalHeight;
            if ( ! nw || ! nh ) return;
            var scale = Math.max( fw / nw, fh / nh );
            var ox = nw * scale - fw, oy = nh * scale - fh;
            if ( ox > 1 ) fx = Math.min(100, Math.max(0, sfx - (e.clientX - sx) / ox * 100));
            if ( oy > 1 ) fy = Math.min(100, Math.max(0, sfy - (e.clientY - sy) / oy * 100));
            apply();
        });
        ['pointerup','pointercancel'].forEach(function(ev){
            frame.addEventListener(ev, function(){
                dragging = false;
                frame.classList.remove('is-dragging');
            });
        });

        resetBtn.addEventListener('click', function(){ fx = 50; fy = 50; apply(); });
        ratioBtn.addEventListener('click', function(){
            var sp = frame.classList.toggle('is-sp');
            ratioBtn.textContent = sp ? 'PC比率で確認' : 'スマホ比率で確認';
        });

        /* Gutenberg のアイキャッチ変更にプレビューを追従させる */
        var lastUrl = img.getAttribute('src') || '';
        if ( window.wp && wp.data && wp.data.subscribe ) {
            wp.data.subscribe(function(){
                var sel = wp.data.select('core/editor');
                if ( ! sel || ! sel.getEditedPostAttribute ) return;
                var id = sel.getEditedPostAttribute('featured_media');
                if ( ! id ) {
                    if ( lastUrl ) { lastUrl = ''; setImage(''); }
                    return;
                }
                var media = wp.data.select('core').getMedia( id );
                if ( ! media ) return;
                var url = ( media.media_details && media.media_details.sizes && media.media_details.sizes.large )
                    ? media.media_details.sizes.large.source_url
                    : media.source_url;
                if ( url && url !== lastUrl ) { lastUrl = url; setImage(url); }
            });
        }

        apply();
    })();
    </script>
    <?php
}

/* ── 採用事例 保存 ── */
add_action( 'save_post_rx_case', 'cxcms_save_rx_case_meta' );
function cxcms_save_rx_case_meta( $post_id ) {
    if ( ! isset($_POST['cxcms_rx_case_nonce']) || ! wp_verify_nonce($_POST['cxcms_rx_case_nonce'], 'cxcms_rx_case_save') ) return;
    if ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) return;
    if ( ! current_user_can( 'edit_post', $post_id ) ) return;

    if ( isset($_POST['rx_case_summary']) ) {
        update_post_meta( $post_id, 'rx_case_summary', sanitize_textarea_field( $_POST['rx_case_summary'] ) );
    }

    /* SEO設定 */
    if ( isset($_POST['rx_case_seo_title']) ) {
        update_post_meta( $post_id, 'rx_case_seo_title', sanitize_text_field( $_POST['rx_case_seo_title'] ) );
    }
    if ( isset($_POST['rx_case_seo_description']) ) {
        update_post_meta( $post_id, 'rx_case_seo_description', sanitize_textarea_field( $_POST['rx_case_seo_description'] ) );
    }

    /* タグ（メタボックス内チェックボックスが唯一の編集UI。全解除も保存できるようマーカーで判定） */
    if ( isset($_POST['rx_case_tags_present']) ) {
        $tag_ids = array_map( 'intval', (array) ( $_POST['rx_case_tags'] ?? [] ) );
        wp_set_object_terms( $post_id, $tag_ids, 'rx_case_tag' );
    }

    /* フォーカルポイント（0〜100%にクランプ） */
    foreach ( [ 'rx_case_focal_x', 'rx_case_focal_y' ] as $k ) {
        if ( isset($_POST[$k]) && is_numeric($_POST[$k]) ) {
            update_post_meta( $post_id, $k, max( 0, min( 100, round( (float) $_POST[$k], 1 ) ) ) );
        }
    }

    /* 実績数値ブロック（最大3・項目名+数値が揃った行のみ保存） */
    if ( isset($_POST['rx_case_stat_label']) && is_array($_POST['rx_case_stat_label']) ) {
        $labels = $_POST['rx_case_stat_label'];
        $values = (array) ( $_POST['rx_case_stat_value'] ?? [] );
        $units  = (array) ( $_POST['rx_case_stat_unit'] ?? [] );
        $arrows = (array) ( $_POST['rx_case_stat_arrow'] ?? [] );
        $stats  = [];
        for ( $i = 0; $i < 3; $i++ ) {
            $label = sanitize_text_field( $labels[$i] ?? '' );
            $value = sanitize_text_field( $values[$i] ?? '' );
            if ( $label === '' || $value === '' ) continue;
            $arrow = $arrows[$i] ?? 'none';
            $stats[] = [
                'label' => $label,
                'value' => $value,
                'unit'  => sanitize_text_field( $units[$i] ?? '' ),
                'arrow' => in_array( $arrow, [ 'none', 'up', 'down' ], true ) ? $arrow : 'none',
            ];
        }
        update_post_meta( $post_id, 'rx_case_stats', wp_json_encode( $stats, JSON_UNESCAPED_UNICODE ) );
    }
}

/* ── 採用事例 管理画面カスタム列 ── */
add_filter( 'manage_rx_case_posts_columns', function( $cols ) {
    $new = [];
    foreach ( $cols as $k => $v ) {
        $new[$k] = $v;
        if ( $k === 'title' ) $new['rx_case_thumb'] = 'メイン画像';
    }
    return $new;
});
add_action( 'manage_rx_case_posts_custom_column', function( $col, $post_id ) {
    if ( $col !== 'rx_case_thumb' ) return;
    $thumb_id = get_post_thumbnail_id( $post_id );
    if ( $thumb_id ) {
        $img = wp_get_attachment_image_src( $thumb_id, 'thumbnail' );
        $fx = get_post_meta( $post_id, 'rx_case_focal_x', true );
        $fy = get_post_meta( $post_id, 'rx_case_focal_y', true );
        $fx = ( $fx === '' ) ? 50 : (float) $fx;
        $fy = ( $fy === '' ) ? 50 : (float) $fy;
        if ( $img ) echo '<img src="' . esc_url( $img[0] ) . '" style="width:48px;height:60px;object-fit:cover;object-position:' . esc_attr( $fx ) . '% ' . esc_attr( $fy ) . '%;border-radius:3px">';
    } else {
        echo '<span style="color:#bbb">—</span>';
    }
}, 10, 2 );

/* ── REST ルート ── */
add_action( 'rest_api_init', function() {
    register_rest_route( 'contentsx/v1', '/cases', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_rx_cases',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route( 'contentsx/v1', '/cases/(?P<id>\d+)', [
        'methods'  => 'GET',
        'callback' => 'cxcms_api_rx_case_single',
        'permission_callback' => '__return_true',
        'args' => [
            'id' => [ 'validate_callback' => function($v){ return is_numeric($v); } ],
        ],
    ]);
    /* ── 認証付きインポート（Application Password等でログインしたユーザーのみ） ── */
    register_rest_route( 'contentsx/v1', '/cases-import', [
        'methods'  => 'POST',
        'callback' => 'cxcms_api_rx_case_import',
        'permission_callback' => function() { return current_user_can( 'edit_posts' ); },
    ]);
});

/* ── 採用事例インポート（全フィールド一括・slug一致で更新／無ければ新規・既定は下書き） ── */
function cxcms_api_rx_case_import( $req ) {
    $b = $req->get_json_params();
    if ( ! is_array( $b ) ) {
        return new WP_Error( 'bad_body', 'JSON本文が必要です', [ 'status' => 400 ] );
    }
    $title = sanitize_text_field( $b['title'] ?? '' );
    $slug  = sanitize_title( $b['slug'] ?? '' );
    if ( $title === '' || $slug === '' ) {
        return new WP_Error( 'missing', 'title と slug は必須です', [ 'status' => 400 ] );
    }
    $status = ( ( $b['status'] ?? 'draft' ) === 'publish' ) ? 'publish' : 'draft';

    /* slug一致の既存 rx_case を探す（再実行時は更新・重複を作らない） */
    $existing = get_posts([
        'post_type'   => 'rx_case',
        'name'        => $slug,
        'post_status' => [ 'publish', 'draft', 'pending', 'future', 'private' ],
        'numberposts' => 1,
    ]);
    $postarr = [
        'post_type'    => 'rx_case',
        'post_title'   => $title,
        'post_name'    => $slug,
        'post_status'  => $status,
        'post_content' => wp_kses_post( $b['content'] ?? '' ),
    ];
    if ( $existing ) {
        $postarr['ID'] = $existing[0]->ID;
        $post_id = wp_update_post( $postarr, true );
        $action = 'updated';
    } else {
        $post_id = wp_insert_post( $postarr, true );
        $action = 'created';
    }
    if ( is_wp_error( $post_id ) ) {
        return new WP_Error( 'save_failed', $post_id->get_error_message(), [ 'status' => 500 ] );
    }

    /* 概要・SEO */
    if ( isset( $b['summary'] ) ) {
        update_post_meta( $post_id, 'rx_case_summary', sanitize_textarea_field( $b['summary'] ) );
    }
    if ( isset( $b['seo_title'] ) ) {
        update_post_meta( $post_id, 'rx_case_seo_title', sanitize_text_field( $b['seo_title'] ) );
    }
    if ( isset( $b['seo_description'] ) ) {
        update_post_meta( $post_id, 'rx_case_seo_description', sanitize_textarea_field( $b['seo_description'] ) );
    }

    /* 実績数値（最大3・項目名+数値が揃った行のみ。保存処理と同形式） */
    if ( isset( $b['stats'] ) && is_array( $b['stats'] ) ) {
        $stats = [];
        foreach ( array_slice( $b['stats'], 0, 3 ) as $s ) {
            if ( ! is_array( $s ) ) continue;
            $label = sanitize_text_field( $s['label'] ?? '' );
            $value = sanitize_text_field( $s['value'] ?? '' );
            if ( $label === '' || $value === '' ) continue;
            $arrow = $s['arrow'] ?? 'none';
            $stats[] = [
                'label' => $label,
                'value' => $value,
                'unit'  => sanitize_text_field( $s['unit'] ?? '' ),
                'arrow' => in_array( $arrow, [ 'none', 'up', 'down' ], true ) ? $arrow : 'none',
            ];
        }
        update_post_meta( $post_id, 'rx_case_stats', wp_json_encode( $stats, JSON_UNESCAPED_UNICODE ) );
    }

    /* タグ（名前で受け取り、無ければ作成してID紐付け。rx_case_tagは階層型のためID指定） */
    if ( isset( $b['tags'] ) && is_array( $b['tags'] ) ) {
        $tag_ids = [];
        foreach ( $b['tags'] as $name ) {
            $name = sanitize_text_field( $name );
            if ( $name === '' ) continue;
            $term = term_exists( $name, 'rx_case_tag' );
            if ( ! $term ) {
                $term = wp_insert_term( $name, 'rx_case_tag' );
            }
            if ( ! is_wp_error( $term ) && isset( $term['term_id'] ) ) {
                $tag_ids[] = (int) $term['term_id'];
            }
        }
        wp_set_object_terms( $post_id, $tag_ids, 'rx_case_tag' );
    }

    /* フォーカルポイント（任意・既定50/50） */
    foreach ( [ 'focal_x' => 'rx_case_focal_x', 'focal_y' => 'rx_case_focal_y' ] as $in => $meta ) {
        if ( isset( $b[$in] ) && is_numeric( $b[$in] ) ) {
            update_post_meta( $post_id, $meta, max( 0, min( 100, round( (float) $b[$in], 1 ) ) ) );
        }
    }

    return rest_ensure_response([
        'ok'     => true,
        'action' => $action,
        'id'     => $post_id,
        'slug'   => get_post_field( 'post_name', $post_id ),
        'status' => get_post_status( $post_id ),
        'edit'   => admin_url( 'post.php?post=' . $post_id . '&action=edit' ),
    ]);
}

/* ── 採用事例 整形ヘルパー ── */
function cxcms_format_rx_case( $p ) {
    $m = fn($k) => get_post_meta( $p->ID, $k, true );

    $tags = []; $tag_slugs = [];
    $terms = get_the_terms( $p->ID, 'rx_case_tag' );
    if ( $terms && ! is_wp_error( $terms ) ) {
        foreach ( $terms as $t ) { $tags[] = $t->name; $tag_slugs[] = $t->slug; }
    }

    $thumb_url = '';
    $thumb_id = get_post_thumbnail_id( $p->ID );
    if ( $thumb_id ) {
        $img = wp_get_attachment_image_src( $thumb_id, 'large' );
        if ( $img ) $thumb_url = $img[0];
    }

    $stats = json_decode( $m('rx_case_stats') ?: '[]', true );
    if ( ! is_array( $stats ) ) $stats = [];

    $fx = $m('rx_case_focal_x');
    $fy = $m('rx_case_focal_y');

    return [
        'id'           => $p->ID,
        'slug'         => $p->post_name,
        'date_ymd'     => get_the_date( 'Y-m-d', $p ),
        'modified_ymd' => get_the_modified_date( 'Y-m-d', $p ),
        'company'      => $p->post_title,
        'tags'         => $tags,
        'tag_slugs'    => $tag_slugs,
        'summary'      => $m('rx_case_summary') ?: '',
        'image'        => $thumb_url,
        'focal'        => [
            'x' => ( $fx === '' ) ? 50 : (float) $fx,
            'y' => ( $fy === '' ) ? 50 : (float) $fy,
        ],
        'stats'        => $stats,
        /* SEO（空欄時はフォールバック適用済みの最終値を返し、ビルド側はそのまま使う） */
        'seo_title'       => $m('rx_case_seo_title') ?: ( $p->post_title . 'の採用成功事例｜イチオシ採用' ),
        'seo_description' => $m('rx_case_seo_description') ?: ( $m('rx_case_summary') ?: '' ),
    ];
}

/* ── 採用事例一覧 API ── */
function cxcms_api_rx_cases( $req ) {
    $limit = (int) ( $req->get_param('per_page') ?: 50 );
    if ( $limit <= 0 ) $limit = 50;   // 非数値・負数で全件/0件になるのを防ぐ
    $posts = get_posts([
        'post_type'      => 'rx_case',
        'posts_per_page' => min( $limit, 100 ),
        'orderby'        => 'date',
        'order'          => 'DESC',
        'post_status'    => 'publish',
    ]);
    $out = [];
    foreach ( $posts as $p ) {
        $out[] = cxcms_format_rx_case( $p );
    }
    return rest_ensure_response( $out );
}

/* ── 採用事例個別 API（詳細ページ本文つき） ── */
function cxcms_api_rx_case_single( $req ) {
    $p = get_post( (int) $req['id'] );
    if ( ! $p || $p->post_type !== 'rx_case' || $p->post_status !== 'publish' ) {
        return new WP_Error( 'not_found', '採用事例が見つかりません', [ 'status' => 404 ] );
    }
    $data = cxcms_format_rx_case( $p );
    $data['content'] = apply_filters( 'the_content', $p->post_content );
    return rest_ensure_response( $data );
}
