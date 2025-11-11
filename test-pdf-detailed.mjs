import { readFile } from 'fs/promises';
import { PDFParse } from 'pdf-parse';

async function test() {
  const buffer = await readFile('attached_assets/Wesly_John_du_Toit_CV_1761891890963.pdf');
  
  const parser = new PDFParse({ data: buffer });
  
  // Get detailed info
  const info = await parser.getInfo();
  console.log('PDF Info:', JSON.stringify(info, null, 2));
  
  // Try getting text with different parameters
  const result = await parser.getText({ 
    parsePageInfo: true,
    includeHyperlinks: true
  });
  
  console.log(`\nText extraction:`);
  console.log(`Total pages: ${result.total}`);
  console.log(`Full text length: ${result.text.length}`);
  console.log(`\nPage-by-page:`);
  result.pages.forEach((page, idx) => {
    console.log(`Page ${idx + 1}: ${page.text.length} chars`);
    if (page.text.length > 0 && page.text.length < 200) {
      console.log(`  Content: "${page.text}"`);
    }
  });
  
  await parser.destroy();
}

test().catch(err => console.error('Error:', err));
