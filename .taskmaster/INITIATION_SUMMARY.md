# 🚀 Session Initiation - Quick Answer

## **TL;DR: How to Start a New Terminal Session**

Since your Task Master + SuperClaude coordination bridge is active (PID: 33774), here's what to do:

### **Option 1: Claude Code (RECOMMENDED)**
```bash
cd /Users/aubk/Documents/Projects/dwaybank
/load @dwaybank --coordination taskmaster
```

### **Option 2: Task Master Commands (if tm available)**
```bash
cd /Users/aubk/Documents/Projects/dwaybank
tm init --agents superclaude
```

---

## 🎯 **Quick Decision Tree**

**Question**: "Which should I use - Claude or tm?"

**Answer**: **Use Claude Code with `--coordination taskmaster`**

**Why?**
- ✅ Your coordination bridge is already running
- ✅ SuperClaude commands automatically coordinate with Task Master
- ✅ Access to all 18 agents (12 SuperClaude + 6 Task Master)
- ✅ Intelligent MCP server sharing and load balancing
- ✅ Dynamic coalition formation based on task complexity

---

## 📋 **Step-by-Step for New Terminal**

### **Step 1: Check Status (Optional)**
```bash
cd /Users/aubk/Documents/Projects/dwaybank
./.taskmaster/configs/quick-start.sh
```

### **Step 2: Start Session**
```bash
/load @dwaybank --coordination taskmaster
```

### **Step 3: Use Coordinated Commands**
```bash
# Analysis with agent coordination
/analyze --comprehensive --coordination taskmaster

# Implementation with coalition formation
/implement "payment system" --coordination taskmaster

# Spawn specific agents with coordination
/spawn --agents architect,security,performance --coordination taskmaster
```

---

## 🔄 **What Happens Behind the Scenes**

When you use `--coordination taskmaster`:

1. **SuperClaude** receives your command
2. **Coordination Bridge** (PID: 33774) facilitates communication
3. **Task Master agents** coordinate with **SuperClaude agents**
4. **Intelligent coalition** forms based on task requirements
5. **MCP servers** are shared and load-balanced
6. **Unified execution** with both systems working together

---

## 🏥 **Health Check Commands**

### Quick Status
```bash
./.taskmaster/configs/quick-start.sh
```

### Comprehensive Health Check
```bash
./.taskmaster/configs/health-check.sh
```

### Monitor Activity
```bash
# Coordination bridge activity
tail -f .taskmaster/logs/bridge.log

# Agent ecosystem activity  
tail -f .taskmaster/logs/agents.log
```

---

## 🚨 **If Something's Wrong**

### Bridge Not Running?
```bash
./.taskmaster/configs/startup.sh
```

### Agents Not Responding?
```bash
node activate-full-framework.js
```

### Need Help?
```bash
cat .taskmaster/SESSION_GUIDE.md
```

---

## 💡 **Pro Tips**

1. **Always use `--coordination taskmaster`** with SuperClaude commands
2. **Start with `/load`** to establish project context
3. **Monitor logs** to see coordination in action
4. **Use health checks** before major operations
5. **Leverage coalitions** - let agents team up automatically

---

## 🎉 **Current System Status**

✅ **Coordination Bridge**: Active (PID: 33774)  
✅ **Agent Ecosystem**: 18 agents ready  
✅ **MCP Servers**: 4 shared servers coordinated  
✅ **System Health**: All systems operational  

**Recommendation**: Start with Claude Code using `--coordination taskmaster` flag