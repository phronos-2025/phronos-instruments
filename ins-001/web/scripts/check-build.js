#!/usr/bin/env node
/**
 * Build Diagnostic Script
 * Run after build to verify what routes were generated
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

async function checkBuild() {
  console.log('\n=== BUILD DIAGNOSTIC CHECK ===\n');
  
  // Check .vercel/output structure
  const vercelOutput = '.vercel/output';
  try {
    const vercelStat = await stat(vercelOutput);
    if (vercelStat.isDirectory()) {
      console.log('✓ .vercel/output exists\n');
      
      // Check functions
      const functionsPath = join(vercelOutput, 'functions');
      try {
        const functions = await readdir(functionsPath, { recursive: true });
        console.log('Generated serverless functions:');
        functions.forEach(f => {
          if (f.endsWith('.js') || f.endsWith('.mjs')) {
            console.log(`  - ${f}`);
          }
        });
        console.log('');
      } catch (e) {
        console.log('⚠ Functions directory not found or empty\n');
      }
      
      // Check static files
      const staticPath = join(vercelOutput, 'static');
      try {
        const staticFiles = await readdir(staticPath, { recursive: true });
        console.log('Static files:');
        staticFiles.slice(0, 10).forEach(f => {
          console.log(`  - ${f}`);
        });
        if (staticFiles.length > 10) {
          console.log(`  ... and ${staticFiles.length - 10} more`);
        }
        console.log('');
      } catch (e) {
        console.log('⚠ Static directory not found\n');
      }
      
      // Check config.json
      try {
        const configPath = join(vercelOutput, 'config.json');
        const config = JSON.parse(await readFile(configPath, 'utf-8'));
        console.log('Vercel config routes:');
        if (config.routes) {
          config.routes.forEach((route, i) => {
            console.log(`  ${i + 1}. ${route.src || route.source} → ${route.dest || route.destination}`);
          });
        } else {
          console.log('  No routes defined in config.json');
        }
        console.log('');
      } catch (e) {
        console.log('⚠ config.json not found or invalid\n');
      }
    }
  } catch (e) {
    console.log('✗ .vercel/output not found\n');
  }
  
  // Check dist structure
  const distPath = 'dist';
  try {
    const distStat = await stat(distPath);
    if (distStat.isDirectory()) {
      console.log('✓ dist directory exists\n');
      
      // Check pages
      const pagesPath = join(distPath, 'pages');
      try {
        const pages = await readdir(pagesPath, { recursive: true });
        console.log('Generated pages:');
        pages.forEach(p => {
          if (p.endsWith('.html') || p.endsWith('.mjs')) {
            console.log(`  - ${p}`);
          }
        });
        console.log('');
      } catch (e) {
        console.log('⚠ Pages directory not found\n');
      }
    }
  } catch (e) {
    console.log('✗ dist directory not found\n');
  }
  
  console.log('=== END DIAGNOSTIC ===\n');
}

checkBuild().catch(console.error);
