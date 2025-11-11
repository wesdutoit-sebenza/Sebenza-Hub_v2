import { readFile } from 'fs/promises';
import { PDFParse } from 'pdf-parse';

async function test() {
  const buffer = await readFile('attached_assets/Wesly_John_du_Toit_CV_1761891890963.pdf');
  console.log(`File size: ${buffer.length} bytes`);
  
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  
  console.log(`SUCCESS! Extracted ${result.text.length} characters from ${result.total} pages`);
  console.log(`First 300 characters:\n${result.text.substring(0, 300)}`);
  
  await parser.destroy();
}

test().catch(err => console.error('Error:', err.message));
