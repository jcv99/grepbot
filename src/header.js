// ==UserScript==
// @name         GrepBot
// @namespace    grepbot
// @version      6.0.25
// @description  Automatizacion de Grepolis: explorar/granjas/construir/comerciar/cultura/reclutar. Los ToS prohiben la automatizacion; riesgo = ban.
// @author       j
// @match        https://*.grepolis.com/*
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
