import {component} from 'flightjs';
import $ from 'jquery';
import {Constants} from './traceConstants';

const entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

const randomHex = (length) => {
  let returnStr = '';
  const str = "abcdefghijklmnopqrstuvwxyz0123456789"
  for (var i = 0; i < length; i++) {
    var index = Math.round(Math.random() * (str.length - 1));
    returnStr += str.substring(index, index + 1);
  }
  return returnStr;
};

function escapeHtml(string) {
  return String(string).replace(/[&<>"'`=\/]/g, s => entityMap[s]);
}

export function isDupeBinaryAnnotation(tagMap, anno) {
  if (!tagMap[anno.key]) {
    tagMap[anno.key] = anno.value; // eslint-disable-line no-param-reassign
  } else if (tagMap[anno.key] === anno.value) {
    return true;
  }
  return false;
}

// Annotation values that contain the word "error" hint of a transient error.
// This adds a class when that's the case.
export function maybeMarkTransientError(row, anno) {
  if (/error/i.test(anno.value)) {
    row.addClass('anno-error-transient');
  }
}

// Normal values are formatted in . However, Quoted json values
// end up becoming javascript objects later. For this reason, we have to guard
// and stringify as necessary.

// annotations are named events which shouldn't hold json. If someone passed
// json, format as a single line. That way the rows corresponding to timestamps
// aren't disrupted.
export function formatAnnotationValue(value) {
  const type = $.type(value);
  if (type === 'object' || type === 'array' || value == null) {
    return escapeHtml(JSON.stringify(value));
  } else {
    return escapeHtml(value.toString()); // prevents false from coercing to empty!
  }
}

// Binary annotations are tags, and sometimes the values are large, for example
// json representing a query or a stack trace. Format these so that they don't
// scroll off the side of the screen.
export function formatBinaryAnnotationValue(value) {
  const type = $.type(value);
  if (type === 'object' || type === 'array' || value == null) {
    return `<pre><code>${escapeHtml(JSON.stringify(value, null, 2))}</code></pre>`;
  }
  const result = value.toString();
  // Preformat if the text includes newlines
  return result.indexOf('\n') === -1 ? escapeHtml(result)
    : `<pre><code>${escapeHtml(result)}</code></pre>`;
}

export default component(function spanPanel() {
  this.$annotationTemplate = null;
  this.$binaryAnnotationTemplate = null;
  this.$moreInfoTemplate = null;

  this.show = function(e, span) {
    const self = this;
    const tagMap = {};

    this.$node.find('.modal-title').text(
      `${span.serviceName}.${span.spanName}: ${span.durationStr}`);

    this.$node.find('.service-names').text(span.serviceNames);

    const $annoBody = this.$node.find('#annotations tbody').text('');
    $.each((span.annotations || []), (i, anno) => {
      const $row = self.$annotationTemplate.clone();
      maybeMarkTransientError($row, anno);
      $row.find('td').each(function() {
        const $this = $(this);
        const propertyName = $this.data('key');
        const text = propertyName === 'value'
          ? formatAnnotationValue(anno.value)
          : anno[propertyName];
        $this.append(text);
      });
      $annoBody.append($row);
    });

    $annoBody.find('.local-datetime').each(function() {
      const $this = $(this);
      const timestamp = $this.text();
      $this.text((new Date(parseInt(timestamp, 10) / 1000)).toLocaleString());
    });

    const $binAnnoBody = this.$node.find('#binaryAnnotations tbody').text('');
    $.each((span.binaryAnnotations || []), (i, anno) => {
      if (isDupeBinaryAnnotation(tagMap, anno)) return;
      const $row = self.$binaryAnnotationTemplate.clone();
      if (anno.key === Constants.ERROR) {
        $row.addClass('anno-error-critical');
      }
      $row.find('td').each(function() {
        const $this = $(this);
        const propertyName = $this.data('key');
        const text = propertyName === 'value'
          ? formatBinaryAnnotationValue(anno.value)
          : escapeHtml(anno[propertyName]);
        $this.append(text);
      });
      $binAnnoBody.append($row);
    });

    const $moreInfoBody = this.$node.find('#moreInfo tbody').text('');
    const moreInfo = [['traceId', span.traceId],
                      ['spanId', span.id],
                      ['parentId', span.parentId]];
    $.each(moreInfo, (i, pair) => {
      const $row = self.$moreInfoTemplate.clone();
      $row.find('.key').text(pair[0]);
      $row.find('.value').text(pair[1]);
      $moreInfoBody.append($row);
    });

    this.$node.modal('show');
    // try {
    const $reSend = this.$node.find('.btn-reSend');
    const spanType = span.binaryAnnotations.find(item => item.key == 'SpanType');
    if(/http(s?)$/.test(spanType.value.toLocaleLowerCase())){
      $reSend.show()
    }else{
      $reSend.hide()
    }
      
    // } catch (error) {
      
    // }
    if(!$reSend.data('hasEvent')){
      $reSend.data('hasEvent', 1);
      $reSend.click( event => {
      let parms = {}
      let csrfKey = ''
      const traceId = randomHex(16);
      const parmsList = span.binaryAnnotations.filter(item => item.key.startsWith('p_'));
      const h_host = span.binaryAnnotations.find(item => item.key == 'h_host');
      const host = h_host ? h_host.value : 'www.icourse163.org';
      const path = span.binaryAnnotations.find(item => item.key == 'http.path');
      const method = span.binaryAnnotations.find(item => item.key == 'http.method');
      const ServerEnv = span.binaryAnnotations.find(item => item.key == 'ServerEnv');
      const contentType = span.binaryAnnotations.find(item => item.key == 'h_content-type');
      const cookie = span.binaryAnnotations.find(item => item.key == 'h_cookie');

      if(ServerEnv && ServerEnv.value=='online'){
        //线上环境
        const { search } = location
        if(search.indexOf('debug=1') == -1){
          alert('线上重放功能需要在当前页面url加debug=1参数;!!谨慎处理线上此功能');
          return ;
        }
      }

      if(parmsList && parmsList.length){
        parmsList.forEach(item => {
          const t = item.key.split('_');
          parms[t[1]] = typeof item.value == 'object' ? JSON.stringify(item.value) :item.value
        })
      }
      
      if(parms.csrfKey){
        csrfKey = parms.csrfKey;
        delete parms.csrfKey
      }
      
      const cookieDto = [];
      if(cookie && cookie.value){
        cookie.value.split(';').forEach((item) => {
          const res = item.split('=');
          const key = res[0].trim();
          const value = res.length ? res[1] : res.slice(1).join('');
          // $.cookie(key, value);  
          // if(key == 'NTESSTUDYSI'){
          //   document.cookie = `${key}=${value};path=/;domain=.icourse163.org;max-age-1`;
          // }
          cookieDto.push({
            name: key,
            value: encodeURIComponent(value)
          })
        })
      }

      

      const fetchResend = () => {
        const _search = csrfKey ? `?csrfKey=${csrfKey}`:'';
          let url = `//${host}${path.value}${_search}`;
          const headers = {
                'X-Zipkin-Extension': '1',
                'X-B3-Sampled': '1',
                'X-B3-Flags': '1',
                'X-B3-TraceId': traceId,
                'X-B3-SpanId': traceId,
                'Content-Type': 'application/x-www-form-urlencoded'
          }
          if(contentType && contentType.value){
            headers['Content-Type'] = contentType.value
          }
          if(parms['mob-token']){
            url = url + '?mob-token=' + parms['mob-token'];
            delete parms['mob-token']
          }
          $.ajax({
            url,
            type: method ? method.value : 'POST',
            data: parms,
            headers,
            crossDomain:true,
            xhrFields: {  
                withCredentials: true // 这里设置了withCredentials  
            }, 
            dataType: 'json'
          }).done(res => {
            const path = location.href.split('/traces/')
            const finalTraceId = res.traceId || traceId
            setTimeout(() => {
              window.open(`${path[0]}/traces/${finalTraceId}`)
            }, 200);
          })
      }

      const cookieDo = (cb) => {
          $.ajax({
          url: '//www.icourse163.org/member/coverCookie.do',
          type: 'POST',
          data: {
            writeCookieAttriList: JSON.stringify(cookieDto),
            domain: host.split('www.')[1]
          },
          headers : {
              'content-type' : 'application/x-www-form-urlencoded'
          },
          crossDomain:true,
          xhrFields: {  
              withCredentials: true
          }, 
        }).done((e) => {
            cb && cb()
        })
      }
      if(path.value.indexOf('/mob/') > -1){
        //mob接口
        fetchResend()
      }else{
        cookieDo(fetchResend)
      }
      
    })
    }
  };

  this.after('initialize', function() {
    this.$node.modal('hide');
    this.$annotationTemplate = this.$node.find('#annotations tbody tr').remove();
    this.$binaryAnnotationTemplate = this.$node.find('#binaryAnnotations tbody tr').remove();
    this.$moreInfoTemplate = this.$node.find('#moreInfo tbody tr').remove();
    this.on(document, 'uiRequestSpanPanel', this.show);
  });
});
