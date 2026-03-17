import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('Project Setup', () => {
  const projectRoot = process.cwd();

  describe('Configuration Files', () => {
    it('should have next.config.mjs with static export', () => {
      const configPath = join(projectRoot, 'next.config.mjs');
      assert.ok(existsSync(configPath), 'next.config.mjs should exist');
      
      const configContent = readFileSync(configPath, 'utf-8');
      assert.ok(configContent.includes("output: 'export'"), 'next.config.mjs should have output: export');
      assert.ok(configContent.includes("distDir: 'dist'"), 'next.config.mjs should have distDir: dist');
    });

    it('should have tsconfig.json with correct configuration', () => {
      const tsconfigPath = join(projectRoot, 'tsconfig.json');
      assert.ok(existsSync(tsconfigPath), 'tsconfig.json should exist');
      
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
      assert.ok(tsconfig.compilerOptions, 'tsconfig should have compilerOptions');
      assert.strictEqual(tsconfig.compilerOptions.strict, true, 'tsconfig should have strict mode enabled');
      assert.ok(tsconfig.compilerOptions.paths, 'tsconfig should have paths configured');
      assert.ok(tsconfig.compilerOptions.paths['@/*'], 'tsconfig should have @/* path alias');
    });
  });

  describe('Source Files', () => {
    it('should have src/app/layout.tsx', () => {
      const layoutPath = join(projectRoot, 'src', 'app', 'layout.tsx');
      assert.ok(existsSync(layoutPath), 'src/app/layout.tsx should exist');
    });

    it('should have src/app/page.tsx', () => {
      const pagePath = join(projectRoot, 'src', 'app', 'page.tsx');
      assert.ok(existsSync(pagePath), 'src/app/page.tsx should exist');
    });

    it('should have proper metadata in layout', () => {
      const layoutPath = join(projectRoot, 'src', 'app', 'layout.tsx');
      const layoutContent = readFileSync(layoutPath, 'utf-8');
      assert.ok(layoutContent.includes('Houston Home Spotlight'), 'Layout should have Houston Home Spotlight title');
      assert.ok(layoutContent.includes('NB Elite Realty'), 'Layout should mention NB Elite Realty');
    });
  });

  describe('Folder Structure', () => {
    it('should have components folder', () => {
      assert.ok(existsSync(join(projectRoot, 'src', 'components')), 'src/components folder should exist');
    });

    it('should have lib folder', () => {
      assert.ok(existsSync(join(projectRoot, 'src', 'lib')), 'src/lib folder should exist');
    });

    it('should have data folder', () => {
      assert.ok(existsSync(join(projectRoot, 'src', 'data')), 'src/data folder should exist');
    });

    it('should have types folder with index.ts', () => {
      assert.ok(existsSync(join(projectRoot, 'src', 'types')), 'src/types folder should exist');
      assert.ok(existsSync(join(projectRoot, 'src', 'types', 'index.ts')), 'src/types/index.ts should exist');
    });
  });

  describe('Package.json', () => {
    it('should have correct scripts', () => {
      const packagePath = join(projectRoot, 'package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      
      assert.ok(packageJson.scripts.test, 'package.json should have test script');
      assert.ok(packageJson.scripts.typecheck, 'package.json should have typecheck script');
      assert.ok(packageJson.scripts.dev, 'package.json should have dev script');
      assert.ok(packageJson.scripts.build, 'package.json should have build script');
    });

    it('should have Next.js 14', () => {
      const packagePath = join(projectRoot, 'package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      
      assert.ok(packageJson.dependencies.next.startsWith('14.'), 'Next.js should be version 14.x');
    });
  });

  describe('.gitignore', () => {
    it('should have proper entries', () => {
      const gitignorePath = join(projectRoot, '.gitignore');
      assert.ok(existsSync(gitignorePath), '.gitignore should exist');
      
      const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
      assert.ok(gitignoreContent.includes('node_modules'), '.gitignore should ignore node_modules');
      assert.ok(gitignoreContent.includes('.env'), '.gitignore should ignore .env files');
      assert.ok(gitignoreContent.includes('.next'), '.gitignore should ignore .next folder');
    });
  });
});
