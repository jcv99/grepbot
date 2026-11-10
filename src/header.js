// ==UserScript==
// @name         GrepBot
// @namespace    grepbot
// @version      6.1.03
// @description  Automatizacion de Grepolis: explorar/granjas/construir/comerciar/cultura/reclutar. Los ToS prohiben la automatizacion; riesgo = ban.
// @author       j
// @license      GPL-3.0-or-later
// @match        https://*.grepolis.com/*
// @run-at       document-idle
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
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
  const __gbStart = () => {
