<?php
/**
 * Plugin Name: ContentsX CMS
 * Description: ContentsX サイト用カスタム投稿タイプ・REST API（漫画事例・ニュース）
 * Version: 1.0.0
 * Author: ContentsX
 * Text Domain: contentsx-cms
 */

if ( ! defined( 'ABSPATH' ) ) exit;

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
        'supports'     => [ 'title', 'editor', 'custom-fields' ],
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
   2. カスタムフィールド（メタボックス）
   ========================================================== */

add_action( 'add_meta_boxes', 'cxcms_add_meta_boxes' );

function cxcms_add_meta_boxes() {
    add_meta_box( 'manga_work_fields', '漫画事例 詳細', 'cxcms_manga_meta_html', 'manga_work', 'normal', 'high' );
    add_meta_box( 'cx_news_fields', 'ニュース詳細', 'cxcms_news_meta_html', 'cx_news', 'normal', 'high' );
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
            <label>ページ数</label>
            <input type="number" name="cx_pages" value="<?php echo esc_attr($m('cx_pages')); ?>">
        </div>
        <div class="cx-field">
            <label>クライアント名</label>
            <input name="cx_client" value="<?php echo esc_attr($m('cx_client')); ?>">
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
    <div class="cx-field">
        <label>表示順（数字が小さい＝先に表示）</label>
        <input type="number" name="cx_sort_order" value="<?php echo esc_attr($m('cx_sort_order') ?: '0'); ?>">
    </div>
    <div class="cx-field">
        <label>新作情報に表示</label>
        <select name="cx_is_new">
            <option value="0" <?php selected($m('cx_is_new'), '0'); ?>>表示しない</option>
            <option value="1" <?php selected($m('cx_is_new'), '1'); ?>>表示する</option>
        </select>
        <div class="cx-hint">「表示する」にすると index の新作情報セクションに出ます</div>
    </div>
    <div class="cx-field">
        <label>新作 追加日</label>
        <input type="date" name="cx_added_date" value="<?php echo esc_attr($m('cx_added_date')); ?>">
    </div>
    <?php
}

/* ── ニュース メタボックス HTML ── */
function cxcms_news_meta_html( $post ) {
    wp_nonce_field( 'cxcms_news_save', 'cxcms_news_nonce' );
    $m = fn($k) => get_post_meta( $post->ID, $k, true );
    ?>
    <style>.cx-field{margin:10px 0}.cx-field label{display:block;font-weight:700;margin-bottom:4px}.cx-field input{width:100%;padding:6px 8px}.cx-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}</style>
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
    <?php
}

/* ── メタ保存 ── */
add_action( 'save_post_manga_work', 'cxcms_save_manga_meta' );
function cxcms_save_manga_meta( $post_id ) {
    if ( ! isset($_POST['cxcms_manga_nonce']) || ! wp_verify_nonce($_POST['cxcms_manga_nonce'], 'cxcms_manga_save') ) return;
    if ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) return;
    $fields = ['cx_work_id','cx_title_en','cx_pages','cx_client','cx_spec_pages','cx_spec_period','cx_media','cx_point','cx_comment','cx_sort_order','cx_is_new','cx_added_date'];
    foreach ( $fields as $f ) {
        if ( isset($_POST[$f]) ) update_post_meta( $post_id, $f, sanitize_text_field($_POST[$f]) );
    }
}

add_action( 'save_post_cx_news', 'cxcms_save_news_meta' );
function cxcms_save_news_meta( $post_id ) {
    if ( ! isset($_POST['cxcms_news_nonce']) || ! wp_verify_nonce($_POST['cxcms_news_nonce'], 'cxcms_news_save') ) return;
    if ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) return;
    $fields = ['cx_news_title_en','cx_news_url'];
    foreach ( $fields as $f ) {
        if ( isset($_POST[$f]) ) update_post_meta( $post_id, $f, sanitize_text_field($_POST[$f]) );
    }
}


/* ==========================================================
   3. REST API カスタムフィールドを公開
   ========================================================== */

add_action( 'rest_api_init', 'cxcms_register_rest_fields' );

function cxcms_register_rest_fields() {

    /* ── 漫画事例のフィールド ── */
    $manga_fields = ['cx_work_id','cx_title_en','cx_pages','cx_client','cx_spec_pages','cx_spec_period','cx_media','cx_point','cx_comment','cx_sort_order','cx_is_new','cx_added_date'];
    foreach ( $manga_fields as $f ) {
        register_rest_field( 'manga_work', $f, [
            'get_callback' => fn($obj) => get_post_meta( $obj['id'], $f, true ),
            'schema'       => [ 'type' => 'string' ],
        ]);
    }

    /* ── ニュースのフィールド ── */
    $news_fields = ['cx_news_title_en','cx_news_url'];
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

add_action( 'rest_api_init', function() {
    remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
    add_filter( 'rest_pre_serve_request', function( $value ) {
        /* 許可するオリジン（本番ドメインに変更してください） */
        $allowed = [
            'https://contentsx.jp',
            'https://www.contentsx.jp',
            'https://bizmanga.contentsx.jp',
            'http://localhost:3000',
            'http://127.0.0.1:5500',       // VS Code Live Server
        ];
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ( in_array( $origin, $allowed, true ) ) {
            header( 'Access-Control-Allow-Origin: ' . $origin );
        }
        header( 'Access-Control-Allow-Methods: GET, OPTIONS' );
        header( 'Access-Control-Allow-Headers: Content-Type' );
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
});

/* ── 全漫画事例 ── */
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
        $m = fn($k) => get_post_meta( $p->ID, $k, true );
        $media_raw = $m('cx_media');
        $media = $media_raw ? array_map('trim', explode(',', str_replace('、', ',', $media_raw))) : [];
        $out[] = [
            'id'       => $m('cx_work_id') ?: sanitize_title($p->post_title),
            'title_ja' => $p->post_title,
            'title_en' => $m('cx_title_en'),
            'pages'    => (int) $m('cx_pages'),
            'category' => cxcms_get_first_term( $p->ID, 'manga_category' ),
            'client'   => $m('cx_client'),
            'media'    => $media,
            'spec'     => [
                'pages'  => $m('cx_spec_pages'),
                'period' => $m('cx_spec_period'),
            ],
            'point'    => $m('cx_point'),
            'comment'  => $m('cx_comment'),
        ];
    }
    return new WP_REST_Response( $out, 200 );
}

/* ── 新作情報 ── */
function cxcms_api_works_new( $req ) {
    $posts = get_posts([
        'post_type'      => 'manga_work',
        'posts_per_page' => 10,
        'meta_key'       => 'cx_added_date',
        'orderby'        => 'meta_value',
        'order'          => 'DESC',
        'post_status'    => 'publish',
        'meta_query'     => [[ 'key' => 'cx_is_new', 'value' => '1' ]],
    ]);
    $out = [];
    foreach ( $posts as $p ) {
        $m = fn($k) => get_post_meta( $p->ID, $k, true );
        $out[] = [
            'id'       => $m('cx_work_id') ?: sanitize_title($p->post_title),
            'title_ja' => $p->post_title,
            'title_en' => $m('cx_title_en'),
            'pages'    => (int) $m('cx_pages'),
            'added'    => $m('cx_added_date'),
        ];
    }
    return new WP_REST_Response( $out, 200 );
}

/* ── ニュース一覧 ── */
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
        $out[] = [
            'id'        => $p->ID,
            'date'      => get_the_date( 'Y.m.d', $p ),
            'tag_ja'    => $tag,
            'tag_en'    => cxcms_get_first_term_en( $p->ID, 'news_tag' ),
            'title_ja'  => $p->post_title,
            'title_en'  => $m('cx_news_title_en'),
            'url'       => $m('cx_news_url') ?: '',
            'has_detail' => $has_detail,
        ];
    }
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

    return new WP_REST_Response([
        'id'        => $p->ID,
        'date'      => get_the_date( 'Y.m.d', $p ),
        'tag_ja'    => $tag,
        'tag_en'    => cxcms_get_first_term_en( $p->ID, 'news_tag' ),
        'title_ja'  => $p->post_title,
        'title_en'  => $m('cx_news_title_en'),
        'url'       => $m('cx_news_url') ?: '',
        'content'   => $content,
    ], 200 );
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
        $new[$k] = $v;
        if ( $k === 'title' ) {
            $new['cx_work_id'] = 'ID';
            $new['cx_client']  = 'クライアント';
            $new['cx_pages']   = 'ページ';
            $new['cx_is_new']  = '新作';
        }
    }
    return $new;
});
add_action( 'manage_manga_work_posts_custom_column', function($col, $id) {
    $v = get_post_meta( $id, $col, true );
    if ( $col === 'cx_is_new' ) echo $v === '1' ? '✅' : '—';
    else echo esc_html( $v ?: '—' );
}, 10, 2 );

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
 */
add_filter( 'xmlrpc_enabled', '__return_false' );
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
