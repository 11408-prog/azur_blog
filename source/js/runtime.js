/* 记录运行时间 */
(function(){
  var start = new Date('2026/08/11 00:00:00');

  function update(){
    var now = new Date();
    var diff = now - start;
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    var minutes = Math.floor((diff % 3600000) / 60000);
    var seconds = Math.floor((diff % 60000) / 1000);

    var text = '本站已运行 ' + days + ' 天 ' + hours + ' 小时 ' + minutes + ' 分 ' + seconds + ' 秒';

    // 先尝试找之前创建的元素
    var el = document.getElementById('runtime');
    if(el){
      el.innerText = text;
      return;
    }

    // 如果没有，直接找到页脚插入
    var footer = document.getElementById('footer');
    if(!footer) return;

    var wrapper = document.createElement('div');
    wrapper.id = 'runtime';
    wrapper.style.marginTop = '8px';
    wrapper.style.fontSize = '0.9rem';
    wrapper.innerText = text;

    footer.appendChild(wrapper);
  }

  update();
  setInterval(update, 1000);
})();