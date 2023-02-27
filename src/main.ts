import { EventReceived } from "./stream-elements";

class Raw {
  public toString: () => string;

  constructor(txt: string) {
    this.toString = txt.toString.bind(txt);
  }
}

const escapeHtml = (unsafe: string): string => {
  "use strict";

  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const parseHtml = (str: string): Node[] => {
  "use strict";

  const tmp = document.implementation.createHTMLDocument("");
  tmp.body.innerHTML = str;
  const res: Node[] = [];
  tmp.body.childNodes.forEach((n) => res.push(n));
  return res;
};

const html = (() => {
  "use strict";

  return function html(strings: TemplateStringsArray, ...vars: any[]): Node[] {
    let res = "";
    strings.forEach((str, i) => {
      const s = i === 0 || i === strings.length - 1 ? str.trim() : str;

      res += s;
      if (vars.length > i) {
        const v = vars[i];
        if (Object.prototype.isPrototypeOf.call(Raw.prototype, v)) {
          res += v.toString();
        } else if (v !== null && v !== undefined) {
          res += escapeHtml(v.toString());
        }
      }
    });
    return parseHtml(res);
  };
})();

interface Message {
  userId: string;
  messageId: string;
  color: string;
  name: string;
  text: string;
}

const deleteMessageById = (id: string) => {
  "use strict";

  document.querySelectorAll(`div[message-id="${id}"]`).forEach((node) => {
    node.parentNode.removeChild(node);
  });
};

const deleteMessagesByUser = (user: string) => {
  "use strict";

  document.querySelectorAll(`div[user-id="${user}"]`).forEach((node) => {
    node.parentNode.removeChild(node);
  });
};

const dispatchMessage = (message: Message) => {
  "use strict";

  const chat = document.getElementById("chat");

  chat.prepend(
    html`<div
      class="bubble"
      user-id="${message.userId}"
      message-id="${message.messageId}"
    >
      <span style="color: ${message.color}">${message.name}</span>:
      ${message.text}
    </div>`[0]
  );

  setTimeout(() => {
    deleteMessageById(message.messageId);
  }, 30 * 1_000);
};

const deleteMessage = (messageId: string) => {
  "use strict";

  deleteMessageById(messageId);
};

const purgeUser = (userId: string) => {
  "use strict";

  deleteMessagesByUser(userId);
};

// eslint-disable-next-line no-undef
if (process.env.NODE_ENV === "development") {
  for (const name of ["dispatchMessage", "deleteMessage", "purgeUser"]) {
    // eslint-disable-next-line no-eval
    eval(`window.${name} = ${name}`);
  }
}

window.addEventListener(
  "onEventReceived",
  (obj: CustomEvent<EventReceived>): void => {
    "use strict";

    if (!obj.detail.event) {
      return;
    }

    // @ts-ignore
    if (typeof obj.detail.event.itemId !== "undefined") {
      // @ts-ignore
      obj.detail.listener = "redemption-latest";
    }

    switch (obj.detail.listener) {
      case "message":
        dispatchMessage({
          userId: obj.detail.event.data.userId,
          messageId: obj.detail.event.data.msgId,
          color: obj.detail.event.data.displayColor,
          name: obj.detail.event.data.displayName,
          text: obj.detail.event.data.text,
        });

        break;
      case "delete-message":
        deleteMessage(obj.detail.event.msgId);
        break;
      case "delete-messages":
        purgeUser(obj.detail.event.userId);
        break;
      default:
        break;
    }
  }
);
