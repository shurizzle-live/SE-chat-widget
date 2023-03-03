import { EventReceived, WidgetLoadData } from "stream-elements";
import _parseColor from "parse-css-color";
// @ts-ignore
import hsl2rgb from "pure-color/convert/hsl2rgb";
// @ts-ignore
import rgb2hex from "pure-color/convert/rgb2hex";

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
  text: string | Raw;
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

interface FieldData {
  background: string;
  foreground: string;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

const parseColor = (color: string): RGB | null => {
  "use strict";

  const parsedColor = _parseColor(color);
  if (parsedColor) {
    if (parsedColor.type === "hsl") {
      const rgb = hsl2rgb(parsedColor.values);
      return {
        r: rgb[0],
        g: rgb[1],
        b: rgb[2],
      };
    }

    if (parsedColor.type === "rgb") {
      return {
        r: parsedColor.values[0],
        g: parsedColor.values[1],
        b: parsedColor.values[2],
      };
    }

    return null;
  }

  return null;
};

const luminance = (color: RGB): number => {
  "use strict";

  const r = (color.r / 255) ** 2.2;
  const g = (color.g / 255) ** 2.2;
  const b = (color.b / 255) ** 2.2;

  return 0.2126 * r + 0.7151 * g + 0.0721 * b;
};

const lumRatio = (color1: RGB, color2: RGB): number => {
  "use strict";

  const l1 = luminance(color1) + 0.05;
  const l2 = luminance(color2) + 0.05;

  if (l1 > l2) {
    return l1 / l2;
  }

  return l2 / l1;
};

// @ts-ignore
window.luminance = luminance;
// @ts-ignore
window.lumRatio = lumRatio;

// eslint-disable-next-line no-unused-vars
const makeNeedsStroke = (background: RGB): ((foreground: RGB) => boolean) => {
  "use strict";

  return (foreground: RGB): boolean => {
    return lumRatio(foreground, background) <= 1.4;
  };
};

let needsStroke = makeNeedsStroke({ r: 0x28, g: 0x28, b: 0x28 });

const dispatchMessage = (message: Message) => {
  "use strict";

  const chat = document.getElementById("chat");

  const color = parseColor(message.color) ?? { r: 0xee, g: 0xee, b: 0xee };

  let classes = "name";
  if (needsStroke(color)) {
    classes += " stroke";
  }

  chat.prepend(
    html`<div
      class="bubble"
      user-id="${message.userId}"
      message-id="${message.messageId}"
    >
      <span
        class="${new Raw(classes)}"
        style="color:${new Raw(rgb2hex([color.r, color.g, color.b]))}"
        >${message.name}</span
      >: ${message.text}
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
          text: new Raw(obj.detail.event.renderedText),
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

const invertColor = (color: RGB): RGB => {
  "use strict";

  return {
    r: 255 - color.r,
    g: 255 - color.g,
    b: 255 - color.b,
  };
};

window.addEventListener(
  "onWidgetLoad",
  (event: CustomEvent<WidgetLoadData<FieldData>>) => {
    "use strict";

    const conf: FieldData = event.detail.fieldData;

    let bubbleCss = "";

    const background = parseColor(conf.background);
    if (background) {
      bubbleCss += `background-color:${rgb2hex([
        background.r,
        background.g,
        background.b,
      ])};`;
    }

    const foreground = parseColor(conf.foreground);
    if (foreground) {
      bubbleCss += `color:${rgb2hex([
        foreground.r,
        foreground.g,
        foreground.b,
      ])};`;
    }

    const b = background ?? { r: 0x28, g: 0x28, b: 0x28 };
    needsStroke = makeNeedsStroke(b);
    const f = invertColor(b);
    const hexf = rgb2hex([f.r, f.g, f.b]);

    const nameCss = `.name.stroke{text-shadow:1px 1px 0 ${hexf}, -1px -1px 0 ${hexf}, 1px -1px 0 ${hexf},
    -1px 1px 0 ${hexf}}`;

    if (bubbleCss.length > 0) {
      bubbleCss = `.bubble{${bubbleCss}}`;
    }

    document.body.appendChild(
      html`<style>
        ${bubbleCss}${nameCss}
      </style>`[0]
    );
  }
);
