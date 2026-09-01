// ==UserScript==
// @name         GrepBot
// @namespace    grepbot
// @version      6.0.15-rc4-dev16
// @description  Automatizacion de Grepolis: explorar/granjas/construir/comerciar/cultura/reclutar. Los ToS prohiben la automatizacion; riesgo = ban.
// @author       j
// @match        https://*.grepolis.com/*
// @updateURL    https://github.com/jcv99/grepbot/raw/refs/heads/main/grepbot.user.js
// @downloadURL  https://github.com/jcv99/grepbot/raw/refs/heads/main/grepbot.user.js
// @run-at       document-idle
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @connect      grepolis.com
// @connect      discord.com
// @connect      discordapp.com
// @connect      api.telegram.org
// ==/UserScript==

(function () {
  'use strict';
