// Interactive AI Terminal Logic for Salman Toha's Hub
document.addEventListener('DOMContentLoaded', () => {
  const shellInput = document.getElementById('shell-input');
  const shellOutput = document.getElementById('shell-output');

  if (!shellInput || !shellOutput) return;

  const commands = {
    help: `Available Commands:
  • about     - View Salman's bio and architecture expertise
  • skills    - List top tech stack, MERN, and AI mastery
  • stats     - Show self-hosted GitHub statistics
  • contact   - Get direct email and social profiles
  • clear     - Clear the terminal screen`,
    
    about: `[SALMAN TOHA - FULL STACK & AI ARCHITECT]
Salman Toha is an innovative engineer based in Dhaka, Bangladesh 🇧🇩.
He specializes in building complex, high-concurrency web & mobile apps using MERN Stack, React Native, and robust DevOps CI/CD pipelines. Currently expanding deep architectural capabilities in TypeScript and scalable Server Management.`,

    skills: `[CORE COMPETENCIES & TECH STACK]
⚡ Frontend/Mobile: React.js, Next.js, TypeScript, React Native, TailwindCSS/DaisyUI
🔥 Backend/DB:      Node.js, Express.js, MongoDB, MySQL, Firebase, REST/GraphQL
🚀 DevOps/Cloud:    Docker, Linux/KVM/QEMU, Nginx, PM2 CI/CD, Vercel/Netlify
🧠 AI & Data:       Python, TensorFlow, PyTorch, Pandas, MLflow`,

    stats: `[GITHUB SELF-HOSTED STATS ENGINE]
✨ Profile Views:   681+ (Live Tracker)
⭐ Total Stars:     38+ across repositories
🚀 Total Commits:   790+ commits in 2026
🔥 Current Streak:  Active daily commit streak
🏆 Top Languages:   JavaScript (43.8%), TypeScript (34.0%), HTML/CSS`,

    contact: `[CONNECT WITH SALMAN]
📧 Email:      ishrak1846@gmail.com
🐙 GitHub:     https://github.com/TheLunatic1
🌐 Portfolio:  https://salmantoha.vercel.app/
💼 LinkedIn:   https://www.linkedin.com/in/salman-toha/`
  };

  shellInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const inputVal = shellInput.value.trim().toLowerCase();
      shellInput.value = '';

      if (!inputVal) return;

      // Echo input
      const echoEl = document.createElement('p');
      echoEl.innerHTML = `<span class="prompt-symbol">toha@ai-terminal:~$</span> ${inputVal}`;
      shellOutput.appendChild(echoEl);

      // Handle commands
      if (inputVal === 'clear') {
        shellOutput.innerHTML = `<p class="sys-msg">Terminal cleared. Type <span class="cmd-highlight">help</span> for commands.</p>`;
        return;
      }

      const responseText = commands[inputVal] || `Command not found: "${inputVal}". Type "help" to see available commands.`;
      const responseEl = document.createElement('p');
      responseEl.className = 'output-msg';
      responseEl.textContent = responseText;
      shellOutput.appendChild(responseEl);

      // Auto scroll to bottom
      shellOutput.scrollTop = shellOutput.scrollHeight;
    }
  });

  // Keep focus on terminal click
  document.querySelector('.interactive-shell').addEventListener('click', () => {
    shellInput.focus();
  });
});
