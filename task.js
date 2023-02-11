/*
  - 关于本插件
    - 实现类似闹钟的功能，添加任务后将会在指定时间后提醒
    - 任务指令：
      - 添加任务：[xx秒|xx分钟|xx小时|xx天]后提醒我 睡觉
      - 查看任务：定时任务列表
      - 删除任务：删除任务 + id
      
  - by 松坂砂糖 https://github.com/Matsuzaka7/yunzai_task
*/

// 时间转换
const parseTime = (str) => {
  const timeRegex = /(\d+)(秒|分钟|小时|天)/g;
  let match;
  let time = 0;
  while ((match = timeRegex.exec(str))) {
    const [, num, unit] = match;
    switch (unit) {
      case "秒":
        time += parseInt(num) * 1000;
        break;
      case "分钟":
        time += parseInt(num) * 60 * 1000;
        break;
      case "小时":
        time += parseInt(num) * 60 * 60 * 1000;
        break;
      case "天":
        time += parseInt(num) * 24 * 60 * 60 * 1000;
        break;
    }
  }
  return time;
};

// 时间搓转时间
const formatTimestamp = (timestamp) => {
  let date = new Date(timestamp);
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();
  let hours = date.getHours();
  let minutes = date.getMinutes();
  let seconds = date.getSeconds()
  month = month < 10 ? "0" + month : month;
  day = day < 10 ? "0" + day : day;
  hours = hours < 10 ? "0" + hours : hours;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  seconds = seconds < 10 ? "0" + seconds : seconds;

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 创建卡片发送
const cardMessage = async (e, stu) => {  
  let forwardMsg = stu.map(item => {
    return {
      message: 
`id：${item.id}
任务：${item.content}
执行时间：${formatTimestamp(item.endTime)}
如要删除该任务请回复：删除任务${item.id}`,
      nickname: e.sender.card || e.sender.nickname,
      user_id: e.sender.user_id
    }
  })

  if (e.isGroup) {
      forwardMsg = await e.group.makeForwardMsg(forwardMsg)
  } else {
      forwardMsg = await e.friend.makeForwardMsg(forwardMsg)
  }
  //发送消息
  await e.reply(forwardMsg)
}

// 配置项
const config = {
  // 时间到了后是否at用户提醒
  isAt: true,
  // 同一用户最大的任务数量
  singleMaxTaskLength: 5,
  // 任务时间最大边界 (ms)
  maxTime: 1000 * 60 * 60 * 24 * 2,
  // 任务列表
  list: [],
};

export class timeTask extends plugin {
  constructor() {
    super({
      name: "定时任务",
      event: "message",
      priority: 100,
      rule: [
        {
          reg: new RegExp("^((\\d+)(秒|分钟|小时|天))+后"),
          fnc: "addTask",
        },
        {
          reg: "^删除任务*",
          fnc: "DeleteTask",
        },
        {
          reg: "^定时任务列表$",
          fnc: "TaskList",
        }
      ],
    });
  }

  async addTask(e) {
    try {
      const msg = e.msg;
      const qq = e.user.qq;
      const newTime = Date.now();
      const timer = parseTime(msg);
      const content = msg.split(" ")[1].trim();
      if (!content) return e.reply(`空内容哦`);
      if (timer > config.maxTime) {
        e.reply("最大时间不超过2天");
        return;
      }

      // 先执行定时器，因为要拿到定时器的id，用作删除任务
      const timeout = setTimeout(() => {
        e.reply(`叮叮叮：${content}`, config.isAt);
        const findUser = config.list.find((u) => u.user === qq);
        const findIndexTask = findUser.tasks.findIndex(
          (i) => i.endTime === newTime + timer
        );
        if (findIndexTask !== -1) {
          findUser.tasks.splice(findIndexTask, 1);
        }
      }, timer);

      // 查找是否有该用户
      const findUser = config.list.find((u) => u.user === qq);
      if (findUser) {
        if (findUser.tasks.length >= config.singleMaxTaskLength) {
          e.reply(`每一用户最多只能添加${config.singleMaxTaskLength}个任务哦`);
          clearTimeout(timeout);
          return;
        }
        findUser.tasks.push({
          id: timeout,
          createTime: newTime,
          endTime: newTime + timer,
          content,
        });
      } else {
        config.list.push({
          user: qq,
          tasks: [
            {
              id: timeout,
              createTime: newTime,
              endTime: newTime + timer,
              content,
            },
          ],
        });
      }
      e.reply(`好的，${msg.split(" ")[0]}提醒你`);
    } catch (e) {}

    return true;
  }

  async DeleteTask(e) {
    const qq = e.user.qq
    const id = e.msg.split('删除任务')[1].trim()
    const findUser = config.list.find(item => item.user === qq)
    const findTaskIdIndex = findUser ? findUser?.tasks?.findIndex(item => item.id == id) : -1
    if (findTaskIdIndex !== -1 || !findTaskIdIndex) {
      findUser.tasks.splice(findTaskIdIndex, 1)
      clearTimeout(+id)
      e.reply('已删除')
    } else {
      e.reply('您没有该任务哦')
    }
  }

  async TaskList(e) {
    const qq = e.user.qq
    const findUser = config.list.find(item => item.user === qq)
    if (findUser && findUser?.tasks.length !== 0) {
      cardMessage(e, findUser.tasks)
    } else {
      e.reply('目前还没有在执行的任务哦')
    }
  }
}
