//    .-. .----..-.   .-.  .--.  .----. .-. .-..----.  .----. .-. . .-..-. .-.
// .-.| |{ {__  |  `.'  | / {} \ | {}  }| |/ / | {}  \/  {}  \| |/ \| ||  `| |
// | {} |.-._} }| |\ /| |/  /\  \| .-. \| |\ \ |     /\      /|  .'.  || |\  |
// `----'`----' `-' ` `-'`-'  `-'`-' `-'`-' `-'`----'  `----' `-'   `-'`-' `-'
// markdown-parser.js - Simple Markdown to HTML parser
// by Ferretosan !!!!

function parseMarkdown(markdown) {
  let html = markdown;
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>');
  
  // Code blocks (simple)
  html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');
  
  // Task lists (checkboxes) - before list processing
  html = html.replace(/^- \[x\] (.*$)/gim, '<li><input type="checkbox" checked disabled> $1</li>');
  html = html.replace(/^- \[ \] (.*$)/gim, '<li><input type="checkbox" disabled> $1</li>');
  
  // Regular list items
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  
  // Wrap consecutive list items in ul tags
  html = html.replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/gim, '');
  
  // Split into paragraphs first
  const paragraphs = html.split(/\n\s*\n/);
  
  // Process each paragraph
  html = paragraphs.map(para => {
    para = para.trim();
    if (!para) return '';
    
    // Skip if it's already wrapped in block elements
    if (para.match(/^<(h[1-6]|ul|ol|pre|div)/)) {
      return para;
    }
    
    // Replace single line breaks with <br> within paragraphs
    para = para.replace(/\n/g, '<br>');
    
    // Wrap in paragraph tags
    return `<p>${para}</p>`;
  }).join('\n');
  
  return html;
}

// Function to load and display blog post
async function loadBlogPost(filename) {
  try {
    const response = await fetch(`/blog/${filename}`);
    if (!response.ok) {
      throw new Error('Blog post not found');
    }
    
    const markdown = await response.text();
    const html = parseMarkdown(markdown);
    
    // Display in popup
    popupwindowstart(html);
    
  } catch (error) {
    console.error('Error loading blog post:', error);
    popupwindowstart('<h2>Error</h2><p>Sorry, could not load the blog post.</p>');
  }
}
