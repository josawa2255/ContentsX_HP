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
        'supports'     => [ 'title', 'editor', 'custom-fields' ],
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
    add_meta_box( 'cx_testimonial_fields', 'お客様の声 詳細', 'cxcms_testimonial_meta_html', 'cx_testimonial', 'normal', 'high' );
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
        <label>Heroカルーセルに表示</label>
        <?php
        // 後方互換: 旧 cx_show_hero ('1'/'0') → 新 cx_show_hero_site ('both'/'none'/etc.)
        $hero_site_raw = $m('cx_show_hero_site');
        if ( empty($hero_site_raw) ) {
            $hero_site_raw = $m('cx_show_hero') !== '0' ? 'both' : 'none';
        }
        ?>
        <select name="cx_show_hero_site">
            <option value="both" <?php selected($hero_site_raw, 'both'); ?>>両方（BizManga + ContentsX）</option>
            <option value="bizmanga" <?php selected($hero_site_raw, 'bizmanga'); ?>>BizMangaのみ</option>
            <option value="contentsx" <?php selected($hero_site_raw, 'contentsx'); ?>>ContentsXのみ</option>
            <option value="none" <?php selected($hero_site_raw, 'none'); ?>>表示しない</option>
        </select>
        <div class="cx-hint">トップページのHero背景カルーセルにどちらのサイトで表示するか選べます（デフォルト: 両方）</div>
    </div>
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
        <div class="cx-hint">漫画の各ページ画像をアップロード（表紙は右サイドバーの「表紙の画像」で設定）。ドラッグで順番変更可。ファイル名の番号順で自動ソートされます。</div>
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
    <div class="cx-field">
        <label>表示先サイト</label>
        <select name="cx_news_show_site">
            <option value="both" <?php selected($m('cx_news_show_site'), 'both'); ?>>両方（BizManga + ContentsX）</option>
            <option value="bizmanga" <?php selected($m('cx_news_show_site'), 'bizmanga'); ?>>BizMangaのみ</option>
            <option value="contentsx" <?php selected($m('cx_news_show_site'), 'contentsx'); ?>>ContentsXのみ</option>
        </select>
        <div class="cx-hint">このニュースをどちらのサイトに表示するか選べます</div>
    </div>
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
    $fields = ['cx_work_id','cx_title_en','cx_pages','cx_client','cx_spec_pages','cx_spec_period','cx_media','cx_point','cx_comment','cx_sort_order','cx_show_hero','cx_show_hero_site','cx_is_new','cx_added_date','cx_gallery','cx_akapen_gallery','cx_name_gallery','cx_show_library','cx_show_site','cx_show_gallery_bizmanga','cx_show_new_contentsx'];
    foreach ( $fields as $f ) {
        if ( isset($_POST[$f]) ) update_post_meta( $post_id, $f, sanitize_text_field($_POST[$f]) );
    }
}

add_action( 'save_post_cx_news', 'cxcms_save_news_meta' );
function cxcms_save_news_meta( $post_id ) {
    if ( ! isset($_POST['cxcms_news_nonce']) || ! wp_verify_nonce($_POST['cxcms_news_nonce'], 'cxcms_news_save') ) return;
    if ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) return;
    $fields = ['cx_news_title_en','cx_news_url','cx_news_show_site'];
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
    $manga_fields = ['cx_work_id','cx_title_en','cx_pages','cx_client','cx_spec_pages','cx_spec_period','cx_media','cx_point','cx_comment','cx_sort_order','cx_is_new','cx_added_date','cx_show_library','cx_show_site','cx_show_gallery_bizmanga','cx_show_new_contentsx'];
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
});

/* ── ヘルパー: 漫画事例の共通データ整形 ── */
function cxcms_format_work( $p ) {
    $m = fn($k) => get_post_meta( $p->ID, $k, true );
    $media_raw = $m('cx_media');
    $media = $media_raw ? array_map('trim', explode(',', str_replace('、', ',', $media_raw))) : [];

    /* アイキャッチ画像URL（表紙） */
    $thumb_url = '';
    $thumb_id = get_post_thumbnail_id( $p->ID );
    if ( $thumb_id ) {
        $img = wp_get_attachment_image_src( $thumb_id, 'full' );
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

    return [
        'id'        => $m('cx_work_id') ?: sanitize_title($p->post_title),
        'title_ja'  => $p->post_title,
        'title_en'  => $m('cx_title_en'),
        'pages'     => (int) $m('cx_pages'),
        'category'  => cxcms_get_first_term( $p->ID, 'manga_category' ),
        'client'    => $m('cx_client'),
        'media'     => $media,
        'spec'      => [
            'pages'  => $m('cx_spec_pages'),
            'period' => $m('cx_spec_period'),
        ],
        'point'     => $m('cx_point'),
        'comment'   => $m('cx_comment'),
        'show_hero'    => $m('cx_show_hero') !== '0',
        'show_hero_site' => $m('cx_show_hero_site') ?: ( $m('cx_show_hero') !== '0' ? 'both' : 'none' ),
        'show_library' => $m('cx_show_library') !== '0',
        'show_site'    => $m('cx_show_site') ?: 'both',
        'thumbnail' => $thumb_url,
        'gallery'   => $gallery_urls,
        'akapen_gallery' => $akapen_urls,
        'name_gallery'   => $name_urls,
    ];
}

/* ── ヘルパー: サイトフィルター ── */
function cxcms_filter_by_site( $items, $site_param, $site_key = 'show_site' ) {
    if ( empty( $site_param ) ) return $items;
    $site = sanitize_text_field( $site_param );
    return array_values( array_filter( $items, function( $item ) use ( $site, $site_key ) {
        $show = $item[ $site_key ] ?? 'both';
        return $show === 'both' || $show === $site;
    }));
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

    $posts = get_posts([
        'post_type'      => 'manga_work',
        'posts_per_page' => 20,
        'meta_key'       => 'cx_added_date',
        'orderby'        => 'meta_value',
        'order'          => 'DESC',
        'post_status'    => 'publish',
        'meta_query'     => $meta_query,
    ]);
    $out = [];
    foreach ( $posts as $p ) {
        $m = fn($k) => get_post_meta( $p->ID, $k, true );
        $thumb_url = '';
        $thumb_id = get_post_thumbnail_id( $p->ID );
        if ( $thumb_id ) {
            $img = wp_get_attachment_image_src( $thumb_id, 'full' );
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
            'id'        => $m('cx_work_id') ?: sanitize_title($p->post_title),
            'title_ja'  => $p->post_title,
            'title_en'  => $m('cx_title_en'),
            'pages'     => (int) $m('cx_pages'),
            'added'     => $m('cx_added_date'),
            'show_site' => $m('cx_show_site') ?: 'both',
            'thumbnail' => $thumb_url,
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

        /* ビズ書庫非表示の作品をスキップ */
        if ( $m('cx_show_library') === '0' ) continue;

        $thumb_url = '';
        $thumb_id = get_post_thumbnail_id( $p->ID );
        if ( $thumb_id ) {
            $img = wp_get_attachment_image_src( $thumb_id, 'full' );
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
            $new['cx_work_id'] = 'ID';
            $new['cx_client']  = 'クライアント';
            $new['cx_pages']   = 'ページ';
            $new['cx_show_hero_site'] = 'Hero';
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
    $v = get_post_meta( $id, $col, true );
    if ( $col === 'cx_show_hero_site' ) {
        $hs = $v ?: ( get_post_meta($id, 'cx_show_hero', true) !== '0' ? 'both' : 'none' );
        $labels = ['both'=>'両方','bizmanga'=>'BM','contentsx'=>'CX','none'=>'—'];
        echo esc_html( $labels[$hs] ?? '両方' );
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


/* ==========================================================
   9. 漫画事例 一括インポート（初回移行用）
   ========================================================== */

add_action( 'admin_menu', function() {
    add_submenu_page(
        'edit.php?post_type=manga_work',
        '一括インポート',
        '一括インポート',
        'manage_options',
        'cxcms-import',
        'cxcms_import_page'
    );
});

function cxcms_import_page() {
    // インポート実行
    if ( isset($_POST['cxcms_do_import']) && wp_verify_nonce($_POST['_wpnonce'], 'cxcms_import') ) {
        $result = cxcms_run_import();
        echo '<div class="notice notice-success"><p>' . wp_kses_post($result) . '</p></div>';
    }
    // 同期（上書き更新）実行
    if ( isset($_POST['cxcms_do_sync']) && wp_verify_nonce($_POST['_wpnonce'], 'cxcms_import') ) {
        $result = cxcms_run_sync();
        echo '<div class="notice notice-info"><p>' . wp_kses_post($result) . '</p></div>';
    }
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
    $data = cxcms_get_import_data();
    $new_count = 0;
    $dup_count = 0;
    foreach ($data as $w) {
        if (!isset($existing_map[$w['id']])) $new_count++;
    }
    foreach ($existing_map as $wid => $pids) {
        if (count($pids) > 1) $dup_count++;
    }

    echo '<div class="wrap">';
    echo '<h1>漫画事例 一括インポート・同期</h1>';
    echo '<p>フォールバックデータ（' . count($data) . '件）を WordPress に一括登録・同期します。</p>';

    // 重複警告
    if ($dup_count > 0) {
        echo '<div class="notice notice-error"><p>⚠️ <strong>' . $dup_count . ' 件の重複</strong>が検出されました。修復ボタンで古い方を削除できます。</p></div>';
        echo '<form method="post" style="margin-bottom:16px;">';
        wp_nonce_field('cxcms_import');
        echo '<button type="submit" name="cxcms_fix_duplicates" class="button" style="color:#d63638;border-color:#d63638;">重複を修復（古い方を削除）</button>';
        echo '</form>';
    }

    echo '<form method="post" style="display:flex;gap:12px;margin-bottom:24px;">';
    wp_nonce_field('cxcms_import');
    if ($new_count > 0) {
        echo '<button type="submit" name="cxcms_do_import" class="button button-primary button-hero">未登録の ' . $new_count . ' 件をインポート</button>';
    }
    echo '<button type="submit" name="cxcms_do_sync" class="button button-hero">全件を同期（既存データを上書き更新）</button>';
    echo '</form>';

    if ($new_count === 0 && $dup_count === 0) {
        echo '<p>✅ すべての漫画事例が登録済みで、重複もありません。</p>';
    }

    // 登録済みリスト
    echo '<h2>登録状況 (' . count($existing_map) . '件)</h2>';
    echo '<table class="widefat striped" style="max-width:700px;"><thead><tr><th>ID</th><th>状態</th><th>ギャラリー</th></tr></thead><tbody>';
    foreach ($data as $w) {
        $wid = $w['id'];
        $has = isset($existing_map[$wid]);
        $is_dup = $has && count($existing_map[$wid]) > 1;
        $gallery_count = 0;
        if ($has) {
            $gal = get_post_meta($existing_map[$wid][0], 'cx_gallery', true);
            if ($gal) $gallery_count = count(array_filter(explode(',', $gal)));
        }
        $status = $has ? ($is_dup ? '⚠️ 重複(' . count($existing_map[$wid]) . '件)' : '✅') : '❌ 未登録';
        $gal_text = $gallery_count > 0 ? '🖼 ' . $gallery_count . '枚' : '—';
        echo '<tr><td>' . esc_html($wid) . '</td><td>' . $status . '</td><td>' . $gal_text . '</td></tr>';
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

/* 新規インポート（未登録のみ + ギャラリー画像取得） */
function cxcms_run_import() {
    $data = cxcms_get_import_data();
    $existing_map = cxcms_get_existing_map();

    $imported = 0;
    $images = 0;
    foreach ($data as $i => $w) {
        if (isset($existing_map[$w['id']])) continue;

        $post_id = wp_insert_post([
            'post_type'   => 'manga_work',
            'post_title'  => $w['title_ja'],
            'post_status' => 'publish',
        ]);
        if (is_wp_error($post_id)) continue;

        cxcms_write_meta($post_id, $w, $i + 1);
        update_post_meta($post_id, 'cx_is_new', '0');
        update_post_meta($post_id, 'cx_show_hero', '1');
        update_post_meta($post_id, 'cx_show_hero_site', 'both');

        // ギャラリー画像をインポート
        $img_count = cxcms_import_gallery($post_id, $w['id'], $w['pages']);
        $images += $img_count;
        $imported++;
    }
    return $imported . ' 件をインポート（画像 ' . $images . ' 枚取得）';
}

/* 全件同期（既存データをフォールバックで上書き更新） */
function cxcms_run_sync() {
    $data = cxcms_get_import_data();
    $existing_map = cxcms_get_existing_map();

    $updated = 0;
    $created = 0;
    foreach ($data as $i => $w) {
        if (isset($existing_map[$w['id']])) {
            // 既存 → メタデータ上書き（ギャラリー・表示設定はそのまま保持）
            $post_id = $existing_map[$w['id']][0];
            wp_update_post(['ID' => $post_id, 'post_title' => $w['title_ja']]);
            cxcms_write_meta($post_id, $w, $i + 1);
            $updated++;
        } else {
            // 未登録 → 新規作成
            $post_id = wp_insert_post([
                'post_type'   => 'manga_work',
                'post_title'  => $w['title_ja'],
                'post_status' => 'publish',
            ]);
            if (is_wp_error($post_id)) continue;
            cxcms_write_meta($post_id, $w, $i + 1);
            update_post_meta($post_id, 'cx_is_new', '0');
            update_post_meta($post_id, 'cx_show_hero', '1');
            update_post_meta($post_id, 'cx_show_hero_site', 'both');
            $img_count = cxcms_import_gallery($post_id, $w['id'], $w['pages']);
            $created++;
        }
    }
    return '同期完了: ' . $updated . ' 件更新、' . $created . ' 件新規作成';
}

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
        ['id'=>'bms-unso','title_ja'=>'BMS運送','title_en'=>'BMS Transport','pages'=>10,'category'=>'採用','client'=>'BMS運送','media'=>['採用サイト','説明会資料'],'spec_pages'=>'10P','spec_period'=>'2週間','point'=>'運送業界の「きつい」イメージを払拭し、働く人の魅力とやりがいをストーリーで伝える採用漫画。','comment'=>'求人への応募数が増えただけでなく、面接時に漫画の内容を話題にしてくれる方が増えました。'],
        ['id'=>'bms-unso-remake','title_ja'=>'BMS運送（リメイク）','title_en'=>'BMS Transport (Remake)','pages'=>10,'category'=>'採用','client'=>'BMS運送','media'=>['採用サイト','SNS'],'spec_pages'=>'10P','spec_period'=>'2週間','point'=>'初版の反響を踏まえ、よりターゲットに刺さるストーリーラインにリニューアル。キャラクターデザインも一新。','comment'=>'リメイク版は初版以上の反響で、スカウト返信率も向上しました。'],
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

/* ヘルパー: お客様の声データ整形 */
function cxcms_format_testimonial( $p ) {
    $m = fn($k) => get_post_meta( $p->ID, $k, true );

    /* アイキャッチ画像（表紙） */
    $thumb_url = '';
    $thumb_id = get_post_thumbnail_id( $p->ID );
    if ( $thumb_id ) {
        $img = wp_get_attachment_image_src( $thumb_id, 'large' );
        if ( $img ) $thumb_url = $img[0];
    }

    /* タグ */
    $tags = wp_get_object_terms( $p->ID, 'testimonial_tag', [ 'fields' => 'names' ] );
    $tag = ( ! is_wp_error( $tags ) && ! empty( $tags ) ) ? $tags[0] : '';

    return [
        'id'             => $p->ID,
        'heading'        => $m('cx_testimonial_heading') ?: $p->post_title,
        'heading_en'     => $m('cx_testimonial_heading_en') ?: '',
        'excerpt'        => $m('cx_testimonial_excerpt') ?: '',
        'excerpt_en'     => $m('cx_testimonial_excerpt_en') ?: '',
        'thumbnail'      => $thumb_url,
        'img_position'   => $m('cx_testimonial_img_position') ?: 'center',
        'tag'            => $tag,
        'order'          => (int)( $m('cx_testimonial_order') ?: 10 ),
    ];
}
