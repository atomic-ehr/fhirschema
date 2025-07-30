import { describe, it, expect } from 'bun:test';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { translate } from '../../src/converter';

interface GoldenTestCase {
  name: string;
  inputPath: string;
  expectedPath: string;
}

function loadGoldenTests(): GoldenTestCase[] {
  const testDir = __dirname;
  const inputDir = join(testDir, 'inputs');
  const expectedDir = join(testDir, 'expected');
  
  const testCases: GoldenTestCase[] = [];
  
  // Find all .sd.json files
  const inputFiles = readdirSync(inputDir).filter(f => f.endsWith('.sd.json'));
  
  for (const inputFile of inputFiles) {
    const name = basename(inputFile, '.sd.json');
    const expectedFile = `${name}.fs.json`;
    
    // Check in root expected dir
    let expectedPath = join(expectedDir, expectedFile);
    
    // Check in subdirectories (complex, primitive)
    if (!existsSync(expectedPath)) {
      const subdirs = ['complex', 'primitive'];
      for (const subdir of subdirs) {
        const subdirPath = join(expectedDir, subdir, expectedFile);
        if (existsSync(subdirPath)) {
          expectedPath = subdirPath;
          break;
        }
      }
    }
    
    if (existsSync(expectedPath)) {
      testCases.push({
        name,
        inputPath: join(inputDir, inputFile),
        expectedPath
      });
    }
  }
  
  return testCases;
}

function loadJson(path: string): any {
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

describe('Golden Tests', () => {
  const testCases = loadGoldenTests();
  
  if (testCases.length === 0) {
    throw new Error('No golden test cases found! Run scripts/copy-golden-tests.sh first.');
  }
  
  testCases.forEach(({ name, inputPath, expectedPath }) => {
    it(`should correctly convert ${name}`, () => {
      const input = loadJson(inputPath);
      const expected = loadJson(expectedPath);
      
      const result = translate(input);
      
      // Deep equality check
      expect(result).toEqual(expected);
    });
  });
  
  // Additional test to ensure all expected files have corresponding tests
  it('should have tests for all golden files', () => {
    const expectedFiles = [
      'bundle',
      'patient',
      'questionnaire',
      'address',
      'element',
      'extension',
      'backbone-element',
      'string',
      'boolean',
      'unsignedInt'
    ];
    
    const testedNames = testCases.map(tc => tc.name);
    
    for (const expectedFile of expectedFiles) {
      expect(testedNames).toContain(expectedFile);
    }
  });
});