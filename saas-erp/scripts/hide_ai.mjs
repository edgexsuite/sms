import fs from 'fs';

function commentOut(filePath, regex, replacement) {
  try {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content);
    console.log('Fixed ' + filePath);
  } catch (e) { console.error(e); }
}

commentOut('src/layouts/DashboardLayout.tsx', /<AiAssistant \/>/g, '{/* <AiAssistant /> */}');
commentOut('src/pages/ParentPortal.tsx', /<ChatInterface[\s\S]*?\/>/g, '{/* ChatInterface removed temporarily */}');
commentOut('src/pages/StudentPortal.tsx', /<ChatInterface[\s\S]*?\/>/g, '{/* ChatInterface removed temporarily */}');
commentOut('src/pages/TeacherDashboard.tsx', /<ChatInterface[\s\S]*?\/>/g, '{/* ChatInterface removed temporarily */}');
