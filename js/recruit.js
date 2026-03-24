var roleLabels = {
  mangaka:     { ja: '漫画家', en: 'Manga Artist' },
  illustrator: { ja: '作画担当', en: 'Illustrator' }
};
var currentRole = '';

function selectRole(role) {
  currentRole = role;
  // カード選択状態
  document.querySelectorAll('.recruit-card').forEach(function(c) {
    c.classList.toggle('selected', c.getAttribute('data-role') === role);
  });
  // hidden input
  document.getElementById('roleInput').value = role;
  // バッジ表示
  var lang = document.documentElement.lang || 'ja';
  var badge = document.getElementById('selectedRoleBadge');
  var labelObj = roleLabels[role];
  badge.textContent = lang === 'en' ? labelObj.en : labelObj.ja;
  badge.setAttribute('data-ja', labelObj.ja);
  badge.setAttribute('data-en', labelObj.en);
  // フォーム表示
  var formSection = document.getElementById('recruitForm');
  formSection.classList.add('active');
  setTimeout(function() {
    formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function backToSelect() {
  document.getElementById('recruitForm').classList.remove('active');
  document.querySelectorAll('.recruit-card').forEach(function(c) {
    c.classList.remove('selected');
  });
  document.getElementById('recruitTop').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// mailto送信
document.getElementById('recruitFormEl').addEventListener('submit', function(e) {
  e.preventDefault();
  var role = document.getElementById('roleInput').value;
  var roleLabel = roleLabels[role] ? roleLabels[role].ja : role;
  var lastName = document.getElementById('rLastName').value;
  var firstName = document.getElementById('rFirstName').value;
  var lastNameKana = document.getElementById('rLastNameKana').value;
  var firstNameKana = document.getElementById('rFirstNameKana').value;
  var email = document.getElementById('rEmail').value;
  var phone = document.getElementById('rPhone').value;
  var age = document.getElementById('rAge').value;
  var experience = document.getElementById('rExperience').value;
  var skills = document.getElementById('rSkills').value;
  var portfolio = document.getElementById('rPortfolio').value;
  var motivation = document.getElementById('rMotivation').value;

  var subject = encodeURIComponent('【採用応募】' + roleLabel + ' - ' + lastName + ' ' + firstName);
  var body = encodeURIComponent(
    '■ 応募職種: ' + roleLabel + '\n\n' +
    '■ お名前: ' + lastName + ' ' + firstName + '（' + lastNameKana + ' ' + firstNameKana + '）\n' +
    '■ メールアドレス: ' + email + '\n' +
    '■ 電話番号: ' + (phone || '未記入') + '\n' +
    '■ 年齢: ' + (age || '未記入') + '\n\n' +
    '■ 経歴・職歴:\n' + experience + '\n\n' +
    '■ スキル・ツール: ' + (skills || '未記入') + '\n' +
    '■ ポートフォリオ: ' + (portfolio || '未記入') + '\n\n' +
    '■ 志望動機・自己PR:\n' + motivation
  );

  window.location.href = 'mailto:kuromiya2618@gmail.com?subject=' + subject + '&body=' + body;
});
