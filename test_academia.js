/* =======================================================================
 * Test script for Academia - Lesson 1 (Hover)
 * Run with: node test_academia.js
 * ==================================================================== */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  console.log('📍 Navegando a la app...');
  await page.goto('http://127.0.0.1:8899/Cislunar%20Junior%20-%20Ca%C3%B1on%20Labs.html', { waitUntil: 'networkidle' });

  // Click en Academia
  console.log('🏫 Click en botón Academia...');
  await page.click('button[data-a="academia"]');
  await page.waitForTimeout(1000);

  // Verificar que se carga el menú academia
  const academiaTitle = await page.textContent('h1');
  console.log('📋 Título:', academiaTitle);

  // Click en lección 1 (hover)
  console.log('▶ Iniciando Lección 1: Controles Básicos...');
  await page.click('.leccion[data-id="hover"]');
  await page.waitForTimeout(2000);

  // Verificar canvas
  const canvas = await page.$('#academiaCanvas');
  console.log('🎨 Canvas encontrado:', !!canvas);

  // Simular 10 segundos de vuelo con inputs suaves
  console.log('🕐 Simulando 10s de vuelo...');
  for (let i = 0; i < 100; i++) {
    // Input suave: mantener cerca del centro
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(50);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(50);
  }

  // Verificar métricas
  const metrics = await page.evaluate(() => {
    return window.CJ?.FLT?.getState()?.metricas;
  });
  console.log('📊 Métricas:', metrics);

  await page.waitForTimeout(1000);
  await browser.close();
  console.log('✅ Test completado');
})();