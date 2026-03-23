// mailto送信
document.getElementById('contactForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var lastName = document.getElementById('lastName').value;
  var firstName = document.getElementById('firstName').value;
  var lastNameKana = document.getElementById('lastNameKana').value;
  var firstNameKana = document.getElementById('firstNameKana').value;
  var company = document.getElementById('company').value;
  var position = document.getElementById('position').value;
  var email = document.getElementById('email').value;
  var phone = document.getElementById('phone').value;
  var category = document.getElementById('category');
  var categoryText = category.options[category.selectedIndex].text;
  var message = document.getElementById('message').value;

  var subject = encodeURIComponent('【お問い合わせ】' + categoryText + ' - ' + lastName + ' ' + firstName);
  var body = encodeURIComponent(
    '■ お名前: ' + lastName + ' ' + firstName + '（' + lastNameKana + ' ' + firstNameKana + '）\n' +
    '■ 会社名: ' + (company || '未記入') + '\n' +
    '■ 役職: ' + (position || '未記入') + '\n' +
    '■ メールアドレス: ' + email + '\n' +
    '■ 電話番号: ' + (phone || '未記入') + '\n' +
    '■ お問い合わせ種別: ' + categoryText + '\n\n' +
    '■ お問い合わせ内容:\n' + message
  );

  window.location.href = 'mailto:kuromiya2618@gmail.com?subject=' + subject + '&body=' + body;
});
