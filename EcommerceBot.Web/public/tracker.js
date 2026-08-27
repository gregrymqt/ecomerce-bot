/**
 * ECom-Auto-Bot — Script de Rastreamento de Tráfego e Atribuição (tracker.js)
 * Script Client-Side ultraleve para captura de UTMs, IDs de Anúncios (ad_id, fbclid, gclid)
 * e injeção automática em atributos de carrinho para Shopify e Nuvemshop.
 */

(function () {
  'use strict';

  var COOKIE_NAME = '_ec_traffic_utm';
  var COOKIE_DAYS = 30;

  // 1. Obter tenantId a partir da tag do script
  var currentScript = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.indexOf('tracker.js') !== -1) {
        return scripts[i];
      }
    }
    return null;
  })();

  var tenantId = currentScript ? currentScript.getAttribute('data-tenant-id') : null;
  var apiBaseUrl = currentScript ? currentScript.getAttribute('data-api-url') || 'https://api.ecomautobot.com' : 'https://api.ecomautobot.com';

  // 2. Extrair parâmetros da URL
  function getQueryParams() {
    var params = {};
    var search = window.location.search.substring(1);
    if (!search) return params;

    var pairs = search.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].split('=');
      var key = decodeURIComponent(pair[0]).toLowerCase();
      var value = decodeURIComponent(pair[1] || '');
      if (key && value) {
        params[key] = value;
      }
    }
    return params;
  }

  // 3. Helpers de Cookie e Storage
  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(JSON.stringify(value)) + expires + '; path=/; SameSite=Lax';
  }

  function getCookie(name) {
    var nameEQ = name + '=';
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        try {
          return JSON.parse(decodeURIComponent(c.substring(nameEQ.length, c.length)));
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  }

  // 4. Captura e Persistência de UTMs
  var query = getQueryParams();
  var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ad_id', 'fbclid', 'gclid'];
  var hasUtm = false;
  var currentUtmData = {};

  for (var i = 0; i < utmKeys.length; i++) {
    var k = utmKeys[i];
    if (query[k]) {
      currentUtmData[k] = query[k];
      hasUtm = true;
    }
  }

  var storedData = getCookie(COOKIE_NAME);
  if (!storedData) {
    try {
      var ls = localStorage.getItem(COOKIE_NAME);
      if (ls) storedData = JSON.parse(ls);
    } catch (e) {}
  }

  // Se houver nova UTM na URL, atualiza com Last-Touch; caso contrário, mantém a gravada
  var activeData = hasUtm ? currentUtmData : storedData;

  if (activeData) {
    setCookie(COOKIE_NAME, activeData, COOKIE_DAYS);
    try {
      localStorage.setItem(COOKIE_NAME, JSON.stringify(activeData));
    } catch (e) {}
  }

  // 5. Gera SessionId se não existir
  var sessionId = (function () {
    var sId = null;
    try {
      sId = sessionStorage.getItem('_ec_session_id');
      if (!sId) {
        sId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('_ec_session_id', sId);
      }
    } catch (e) {
      sId = 'sess_' + Date.now();
    }
    return sId;
  })();

  // 6. Enviar Pageview/Visita para o Backend se houver tenantId
  if (tenantId && activeData) {
    try {
      var payload = {
        tenant_id: tenantId,
        session_id: sessionId,
        utm_source: activeData.utm_source || null,
        utm_medium: activeData.utm_medium || null,
        utm_campaign: activeData.utm_campaign || null,
        utm_term: activeData.utm_term || null,
        utm_content: activeData.utm_content || null,
        ad_id: activeData.ad_id || null,
        fbclid: activeData.fbclid || null,
        gclid: activeData.gclid || null
      };

      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(apiBaseUrl + '/api/v1/analytics/traffic/visit', blob);
      } else {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', apiBaseUrl + '/api/v1/analytics/traffic/visit', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  // 7. Injeção Automática no Carrinho (Shopify / Nuvemshop)
  function injectCartAttributes() {
    if (!activeData) return;

    var attributes = {
      'ec_utm_source': activeData.utm_source || '',
      'ec_utm_medium': activeData.utm_medium || '',
      'ec_utm_campaign': activeData.utm_campaign || '',
      'ec_ad_id': activeData.ad_id || '',
      'ec_session_id': sessionId
    };

    // Shopify: POST /cart/update.js
    if (window.Shopify || window.location.pathname.indexOf('/cart') !== -1) {
      try {
        var xhrShopify = new XMLHttpRequest();
        xhrShopify.open('POST', '/cart/update.js', true);
        xhrShopify.setRequestHeader('Content-Type', 'application/json');
        xhrShopify.send(JSON.stringify({ attributes: attributes }));
      } catch (e) {}
    }

    // Nuvemshop / Genérico: preencher campos ocultos no formulário de checkout
    try {
      var forms = document.querySelectorAll('form[action*="/checkout"], form[action*="/cart"]');
      forms.forEach(function (form) {
        for (var attr in attributes) {
          if (!form.querySelector('input[name="' + attr + '"]')) {
            var input = document.createElement('input');
            input.type = 'hidden';
            input.name = attr;
            input.value = attributes[attr];
            form.appendChild(input);
          }
        }
      });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCartAttributes);
  } else {
    injectCartAttributes();
  }
})();
