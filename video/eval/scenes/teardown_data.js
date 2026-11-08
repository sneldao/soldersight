window.TD = {
 "generated_from": "eval/results/predictions_*.jsonl",
 "models": [
  {
   "model": "claude-sonnet-5-5",
   "n": 619,
   "auc": 0.766,
   "n_hi_wrong": 0,
   "acc": 0.64,
   "board_acc": 0.438,
   "crop_acc": 0.721,
   "n_hi": 14,
   "acc_hi": 1.0,
   "mean_conf": 0.596
  },
  {
   "model": "claude-opus-5-5",
   "n": 621,
   "auc": 0.835,
   "n_hi_wrong": 0,
   "acc": 0.628,
   "board_acc": 0.406,
   "crop_acc": 0.719,
   "n_hi": 15,
   "acc_hi": 1.0,
   "mean_conf": 0.614
  },
  {
   "model": "gemini-3-1-pro",
   "n": 621,
   "auc": 0.73,
   "n_hi_wrong": 262,
   "acc": 0.572,
   "board_acc": 0.4,
   "crop_acc": 0.642,
   "n_hi": 617,
   "acc_hi": 0.575,
   "mean_conf": 0.932
  },
  {
   "model": "gpt-5-mini",
   "n": 621,
   "auc": 0.455,
   "n_hi_wrong": 0,
   "acc": 0.501,
   "board_acc": 0.428,
   "crop_acc": 0.531,
   "n_hi": 6,
   "acc_hi": 1.0,
   "mean_conf": 0.75
  },
  {
   "model": "grok-4-7",
   "n": 621,
   "auc": 0.7,
   "n_hi_wrong": 5,
   "acc": 0.459,
   "board_acc": 0.339,
   "crop_acc": 0.508,
   "n_hi": 33,
   "acc_hi": 0.848,
   "mean_conf": 0.726
  },
  {
   "model": "kimi-k3-1-pro",
   "n": 621,
   "auc": 0.732,
   "n_hi_wrong": 111,
   "acc": 0.432,
   "board_acc": 0.339,
   "crop_acc": 0.469,
   "n_hi": 284,
   "acc_hi": 0.609,
   "mean_conf": 0.857
  },
  {
   "model": "gpt-5-5",
   "n": 621,
   "auc": 0.765,
   "n_hi_wrong": 8,
   "acc": 0.361,
   "board_acc": 0.256,
   "crop_acc": 0.404,
   "n_hi": 58,
   "acc_hi": 0.862,
   "mean_conf": 0.792
  }
 ],
 "global": {
  "n": 4345,
  "n_correct": 2229,
  "n_wrong": 2116,
  "mean_conf_correct": 0.773,
  "mean_conf_wrong": 0.731,
  "auc": 0.58,
  "n_hi": 1027,
  "n_hi_wrong": 386,
  "acc_hi": 0.624,
  "calibration": [
   {
    "lo": 0.0,
    "hi": 0.4,
    "n": 26,
    "acc": 0.462
   },
   {
    "lo": 0.4,
    "hi": 0.5,
    "n": 192,
    "acc": 0.24
   },
   {
    "lo": 0.5,
    "hi": 0.6,
    "n": 356,
    "acc": 0.449
   },
   {
    "lo": 0.6,
    "hi": 0.7,
    "n": 804,
    "acc": 0.514
   },
   {
    "lo": 0.7,
    "hi": 0.8,
    "n": 1047,
    "acc": 0.425
   },
   {
    "lo": 0.8,
    "hi": 0.9,
    "n": 893,
    "acc": 0.573
   },
   {
    "lo": 0.9,
    "hi": 1.0,
    "n": 1027,
    "acc": 0.624
   }
  ]
 },
 "exhibits": [
  {
   "task_id": "board:00041013",
   "board_id": "00041013",
   "model": "kimi-k3-1-pro",
   "suite": "board",
   "trial": 0,
   "conf": 0.96,
   "said_type": "pinhole",
   "said_disp": "rework",
   "truth_disp": "scrap",
   "truth_worst": "open",
   "truth_types": [
    "open",
    "short",
    "copper",
    "mousebite",
    "pinhole",
    "spur"
   ],
   "reason": "A small isolated void is visible in the lower copper pad, indicating a pinhole without severing the conductor.",
   "raw": "{\"defect_type\":\"pinhole\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.96,\"reason\":\"A small isolated void is visible in the lower copper pad, indicating a pinhole without severing the conductor.\"}",
   "latency_ms": 7011.9,
   "image": "../../../eval/tasks/images/boards/00041013.jpg"
  },
  {
   "task_id": "board:00041015",
   "board_id": "00041015",
   "model": "kimi-k3-1-pro",
   "suite": "board",
   "trial": 1,
   "conf": 0.96,
   "said_type": "copper",
   "said_disp": "rework",
   "truth_disp": "scrap",
   "truth_worst": "open",
   "truth_types": [
    "open",
    "copper",
    "mousebite",
    "pinhole"
   ],
   "reason": "A small isolated copper speck is present in the clear area below the traces, indicating excess copper with no apparent connection to nearby conductors.",
   "raw": "{\"defect_type\":\"copper\",\"severity\":\"cosmetic\",\"disposition\":\"rework\",\"confidence\":0.96,\"reason\":\"A small isolated copper speck is present in the clear area below the traces, indicating excess copper with no apparent connection to nearby conductors.\"}",
   "latency_ms": 6913.4,
   "image": "../../../eval/tasks/images/boards/00041015.jpg"
  },
  {
   "task_id": "board:00041025",
   "board_id": "00041025",
   "model": "kimi-k3-1-pro",
   "suite": "board",
   "trial": 2,
   "conf": 0.96,
   "said_type": "copper",
   "said_disp": "rework",
   "truth_disp": "scrap",
   "truth_worst": "open",
   "truth_types": [
    "open",
    "short",
    "copper",
    "mousebite",
    "pinhole",
    "spur"
   ],
   "reason": "A small isolated speck of excess copper is visible in the empty area below the circuit traces.",
   "raw": "{\"defect_type\":\"copper\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.96,\"reason\":\"A small isolated speck of excess copper is visible in the empty area below the circuit traces.\"}",
   "latency_ms": 16285.1,
   "image": "../../../eval/tasks/images/boards/00041025.jpg"
  },
  {
   "task_id": "crop:00041006:4",
   "board_id": "00041006",
   "model": "kimi-k3-1-pro",
   "suite": "crop",
   "trial": 1,
   "conf": 0.96,
   "said_type": "spur",
   "said_disp": "rework",
   "truth_disp": "scrap",
   "truth_worst": "open",
   "truth_types": [
    "open",
    "spur"
   ],
   "reason": "A pointed unwanted copper projection extends from the upper edge of the trace, characteristic of a spur.",
   "raw": "{\"defect_type\":\"spur\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.96,\"reason\":\"A pointed unwanted copper projection extends from the upper edge of the trace, characteristic of a spur.\"}",
   "latency_ms": 7646.9,
   "image": "../../../eval/tasks/images/crops/00041006_4.jpg"
  },
  {
   "task_id": "board:00041001",
   "board_id": "00041001",
   "model": "gemini-3-1-pro",
   "suite": "board",
   "trial": 0,
   "conf": 0.95,
   "said_type": "pinhole",
   "said_disp": "rework",
   "truth_disp": "scrap",
   "truth_worst": "open",
   "truth_types": [
    "open",
    "copper",
    "mousebite",
    "pinhole",
    "spur"
   ],
   "reason": "A small pinhole defect is visible in the copper trace.",
   "raw": "{\n  \"defect_type\": \"pinhole\",\n  \"severity\": \"minor\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"A small pinhole defect is visible in the copper trace.\"\n}",
   "latency_ms": 3978.6,
   "image": "../../../eval/tasks/images/boards/00041001.jpg"
  },
  {
   "task_id": "board:00041002",
   "board_id": "00041002",
   "model": "gemini-3-1-pro",
   "suite": "board",
   "trial": 0,
   "conf": 0.95,
   "said_type": "copper",
   "said_disp": "rework",
   "truth_disp": "scrap",
   "truth_worst": "short",
   "truth_types": [
    "short",
    "copper",
    "pinhole",
    "spur"
   ],
   "reason": "There are stray copper spots visible in the clearance area between traces.",
   "raw": "{\n  \"defect_type\": \"copper\",\n  \"severity\": \"minor\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"There are stray copper spots visible in the clearance area between traces.\"\n}",
   "latency_ms": 3897.1,
   "image": "../../../eval/tasks/images/boards/00041002.jpg"
  },
  {
   "task_id": "board:00041013",
   "board_id": "00041013",
   "model": "gemini-3-1-pro",
   "suite": "board",
   "trial": 1,
   "conf": 0.95,
   "said_type": "mousebite",
   "said_disp": "rework",
   "truth_disp": "scrap",
   "truth_worst": "open",
   "truth_types": [
    "open",
    "short",
    "copper",
    "mousebite",
    "pinhole",
    "spur"
   ],
   "reason": "A significant mousebite defect is visible on the edge of the thick vertical trace on the left side of the image, reducing the trace width.",
   "raw": "{\n  \"defect_type\": \"mousebite\",\n  \"severity\": \"major\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"A significant mousebite defect is visible on the edge of the thick vertical trace on the left side of the image, reducing the trace width.\"\n}",
   "latency_ms": 2678.0,
   "image": "../../../eval/tasks/images/boards/00041013.jpg"
  },
  {
   "task_id": "board:00041015",
   "board_id": "00041015",
   "model": "gemini-3-1-pro",
   "suite": "board",
   "trial": 0,
   "conf": 0.95,
   "said_type": "copper",
   "said_disp": "rework",
   "truth_disp": "scrap",
   "truth_worst": "open",
   "truth_types": [
    "open",
    "copper",
    "mousebite",
    "pinhole"
   ],
   "reason": "Isolated copper spot detected on the substrate.",
   "raw": "{\n  \"defect_type\": \"copper\",\n  \"severity\": \"minor\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"Isolated copper spot detected on the substrate.\"\n}",
   "latency_ms": 2817.5,
   "image": "../../../eval/tasks/images/boards/00041015.jpg"
  },
  {
   "task_id": "board:00041020",
   "board_id": "00041020",
   "model": "gemini-3-1-pro",
   "suite": "board",
   "trial": 0,
   "conf": 0.95,
   "said_type": "mousebite",
   "said_disp": "rework",
   "truth_disp": "scrap",
   "truth_worst": "open",
   "truth_types": [
    "open",
    "mousebite",
    "spur"
   ],
   "reason": "Multiple mousebite defects are visible along the edges of the copper traces, reducing the trace width.",
   "raw": "{\n  \"defect_type\": \"mousebite\",\n  \"severity\": \"major\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"Multiple mousebite defects are visible along the edges of the copper traces, reducing the trace width.\"\n}",
   "latency_ms": 3393.4,
   "image": "../../../eval/tasks/images/boards/00041020.jpg"
  },
  {
   "task_id": "board:00041021",
   "board_id": "00041021",
   "model": "gemini-3-1-pro",
   "suite": "board",
   "trial": 1,
   "conf": 0.95,
   "said_type": "copper",
   "said_disp": "rework",
   "truth_disp": "scrap",
   "truth_worst": "open",
   "truth_types": [
    "open",
    "copper",
    "mousebite",
    "pinhole",
    "spur"
   ],
   "reason": "There is a small piece of stray copper on the board surface.",
   "raw": "{\n  \"defect_type\": \"copper\",\n  \"severity\": \"minor\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"There is a small piece of stray copper on the board surface.\"\n}",
   "latency_ms": 2530.9,
   "image": "../../../eval/tasks/images/boards/00041021.jpg"
  },
  {
   "task_id": "crop:00041009:3",
   "board_id": "00041009",
   "model": "gemini-3-1-pro",
   "suite": "crop",
   "trial": 0,
   "conf": 0.95,
   "said_type": "spur",
   "said_disp": "rework",
   "truth_disp": "scrap",
   "truth_worst": "short",
   "truth_types": [
    "short",
    "spur"
   ],
   "reason": "There is a small protrusion (spur) extending from the edge of the trace.",
   "raw": "{\n  \"defect_type\": \"spur\",\n  \"severity\": \"minor\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"There is a small protrusion (spur) extending from the edge of the trace.\"\n}",
   "latency_ms": 3798.6,
   "image": "../../../eval/tasks/images/crops/00041009_3.jpg"
  },
  {
   "task_id": "crop:00041018:2",
   "board_id": "00041018",
   "model": "gemini-3-1-pro",
   "suite": "crop",
   "trial": 0,
   "conf": 0.95,
   "said_type": "copper",
   "said_disp": "rework",
   "truth_disp": "scrap",
   "truth_worst": "open",
   "truth_types": [
    "open",
    "copper"
   ],
   "reason": "An isolated blob of excess copper is present in an area that should be clear.",
   "raw": "{\n  \"defect_type\": \"copper\",\n  \"severity\": \"major\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"An isolated blob of excess copper is present in an area that should be clear.\"\n}",
   "latency_ms": 2534.2,
   "image": "../../../eval/tasks/images/crops/00041018_2.jpg"
  }
 ],
 "false_alarms": [
  {
   "task_id": "board:00041014:clean",
   "board_id": "00041014",
   "model": "kimi-k3-1-pro",
   "suite": "board",
   "trial": 1,
   "conf": 0.96,
   "said_type": "spur",
   "said_disp": "rework",
   "truth_disp": "pass",
   "truth_worst": "none",
   "truth_types": [
    "none"
   ],
   "reason": "A localized copper protrusion extends from the left vertical trace without bridging to an adjacent conductor, consistent with a spur.",
   "raw": "{\"defect_type\":\"spur\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.96,\"reason\":\"A localized copper protrusion extends from the left vertical trace without bridging to an adjacent conductor, consistent with a spur.\"}",
   "latency_ms": 7269.0,
   "image": "../../../eval/tasks/images/boards/00041014_clean.jpg"
  },
  {
   "task_id": "board:00041016:clean",
   "board_id": "00041016",
   "model": "kimi-k3-1-pro",
   "suite": "board",
   "trial": 2,
   "conf": 0.96,
   "said_type": "pinhole",
   "said_disp": "rework",
   "truth_disp": "pass",
   "truth_worst": "none",
   "truth_types": [
    "none"
   ],
   "reason": "A small circular void is visible within the copper trace, consistent with a pinhole that does not fully sever the conductor.",
   "raw": "{\"defect_type\":\"pinhole\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.96,\"reason\":\"A small circular void is visible within the copper trace, consistent with a pinhole that does not fully sever the conductor.\"}",
   "latency_ms": 18788.1,
   "image": "../../../eval/tasks/images/boards/00041016_clean.jpg"
  },
  {
   "task_id": "board:00041025:clean",
   "board_id": "00041025",
   "model": "kimi-k3-1-pro",
   "suite": "board",
   "trial": 1,
   "conf": 0.96,
   "said_type": "spur",
   "said_disp": "rework",
   "truth_disp": "pass",
   "truth_worst": "none",
   "truth_types": [
    "none"
   ],
   "reason": "A small rectangular copper projection extends from the lower trace toward the upper trace without bridging the gap, indicating a spur.",
   "raw": "{\"defect_type\":\"spur\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.96,\"reason\":\"A small rectangular copper projection extends from the lower trace toward the upper trace without bridging the gap, indicating a spur.\"}",
   "latency_ms": 5502.3,
   "image": "../../../eval/tasks/images/boards/00041025_clean.jpg"
  },
  {
   "task_id": "board:00041000:clean",
   "board_id": "00041000",
   "model": "gemini-3-1-pro",
   "suite": "board",
   "trial": 1,
   "conf": 0.95,
   "said_type": "spur",
   "said_disp": "rework",
   "truth_disp": "pass",
   "truth_worst": "none",
   "truth_types": [
    "none"
   ],
   "reason": "A small spur is visible on the edge of the trace.",
   "raw": "{\n  \"defect_type\": \"spur\",\n  \"severity\": \"minor\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"A small spur is visible on the edge of the trace.\"\n}",
   "latency_ms": 3156.4,
   "image": "../../../eval/tasks/images/boards/00041000_clean.jpg"
  },
  {
   "task_id": "board:00041003:clean",
   "board_id": "00041003",
   "model": "gemini-3-1-pro",
   "suite": "board",
   "trial": 0,
   "conf": 0.95,
   "said_type": "pinhole",
   "said_disp": "rework",
   "truth_disp": "pass",
   "truth_worst": "none",
   "truth_types": [
    "none"
   ],
   "reason": "A small pinhole is visible in the trace, which requires rework.",
   "raw": "{\n  \"defect_type\": \"pinhole\",\n  \"severity\": \"minor\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"A small pinhole is visible in the trace, which requires rework.\"\n}",
   "latency_ms": 2734.2,
   "image": "../../../eval/tasks/images/boards/00041003_clean.jpg"
  },
  {
   "task_id": "board:00041004:clean",
   "board_id": "00041004",
   "model": "gemini-3-1-pro",
   "suite": "board",
   "trial": 1,
   "conf": 0.95,
   "said_type": "open",
   "said_disp": "scrap",
   "truth_disp": "pass",
   "truth_worst": "none",
   "truth_types": [
    "none"
   ],
   "reason": "There is a complete break in the trace connecting the two square pads on the right side of the image.",
   "raw": "{\n  \"defect_type\": \"open\",\n  \"severity\": \"critical\",\n  \"disposition\": \"scrap\",\n  \"confidence\": 0.95,\n  \"reason\": \"There is a complete break in the trace connecting the two square pads on the right side of the image.\"\n}",
   "latency_ms": 2457.5,
   "image": "../../../eval/tasks/images/boards/00041004_clean.jpg"
  },
  {
   "task_id": "board:00041005:clean",
   "board_id": "00041005",
   "model": "gemini-3-1-pro",
   "suite": "board",
   "trial": 0,
   "conf": 0.95,
   "said_type": "copper",
   "said_disp": "rework",
   "truth_disp": "pass",
   "truth_worst": "none",
   "truth_types": [
    "none"
   ],
   "reason": "There are stray copper spots visible in the clearance area, which require rework.",
   "raw": "{\n  \"defect_type\": \"copper\",\n  \"severity\": \"minor\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"There are stray copper spots visible in the clearance area, which require rework.\"\n}",
   "latency_ms": 4177.3,
   "image": "../../../eval/tasks/images/boards/00041005_clean.jpg"
  },
  {
   "task_id": "board:00041006:clean",
   "board_id": "00041006",
   "model": "gemini-3-1-pro",
   "suite": "board",
   "trial": 1,
   "conf": 0.95,
   "said_type": "short",
   "said_disp": "scrap",
   "truth_disp": "pass",
   "truth_worst": "none",
   "truth_types": [
    "none"
   ],
   "reason": "A short circuit is visible where two traces are unintentionally connected.",
   "raw": "{\n  \"defect_type\": \"short\",\n  \"severity\": \"critical\",\n  \"disposition\": \"scrap\",\n  \"confidence\": 0.95,\n  \"reason\": \"A short circuit is visible where two traces are unintentionally connected.\"\n}",
   "latency_ms": 3369.4,
   "image": "../../../eval/tasks/images/boards/00041006_clean.jpg"
  }
 ],
 "by_model": {
  "claude-opus-5-5": [
   {
    "task_id": "board:00041017",
    "board_id": "00041017",
    "model": "claude-opus-5-5",
    "suite": "board",
    "trial": 1,
    "conf": 0.8,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A thin gap cuts fully across the diagonal trace in the upper right, just above the pad, which breaks electrical continuity.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.8,\"reason\":\"A thin gap cuts fully across the diagonal trace in the upper right, just above the pad, which breaks electrical continuity.\"}",
    "latency_ms": 3849.0,
    "image": "../../../eval/tasks/images/boards/00041017.jpg"
   },
   {
    "task_id": "board:00041003",
    "board_id": "00041003",
    "model": "claude-opus-5-5",
    "suite": "board",
    "trial": 0,
    "conf": 0.72,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole"
    ],
    "reason": "A thin break runs through the middle pad's annular ring from its top edge to the drilled hole, severing the copper and creating an open circuit; the small pinholes and stray copper speck elsewhere are secondary.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.72,\"reason\":\"A thin break runs through the middle pad's annular ring from its top edge to the drilled hole, severing the copper and creating an open circuit; the small pinholes and stray copper speck elsewhere are secondary.\"}",
    "latency_ms": 4171.0,
    "image": "../../../eval/tasks/images/boards/00041003.jpg"
   },
   {
    "task_id": "board:00041017",
    "board_id": "00041017",
    "model": "claude-opus-5-5",
    "suite": "board",
    "trial": 0,
    "conf": 0.72,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A thin clear gap cuts fully across the upper-right trace where it meets the pad, breaking electrical continuity; small isolated copper specks are also visible in the open area.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.72,\"reason\":\"A thin clear gap cuts fully across the upper-right trace where it meets the pad, breaking electrical continuity; small isolated copper specks are also visible in the open area.\"}",
    "latency_ms": 4026.9,
    "image": "../../../eval/tasks/images/boards/00041017.jpg"
   },
   {
    "task_id": "board:00041008",
    "board_id": "00041008",
    "model": "claude-opus-5-5",
    "suite": "board",
    "trial": 0,
    "conf": 0.7,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole"
    ],
    "reason": "A thin white gap appears to cut fully across the diagonal trace near the center-top (around x\u2248435, y\u2248135), which would break electrical continuity; a pinhole-like void at x\u2248545, y\u2248180 and a stray copper fleck at x\u2248230, y\u2248440 are also visible but are less severe.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.7,\"reason\":\"A thin white gap appears to cut fully across the diagonal trace near the center-top (around x\u2248435, y\u2248135), which would break electrical continuity; a pinhole-like void at x\u2248545, y\u2248180 and a stray copper fleck at x\u2248230, y\u2248440 are also visible but are less severe.\"}",
    "latency_ms": 4190.7,
    "image": "../../../eval/tasks/images/boards/00041008.jpg"
   },
   {
    "task_id": "board:00041011",
    "board_id": "00041011",
    "model": "claude-opus-5-5",
    "suite": "board",
    "trial": 1,
    "conf": 0.7,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "spur"
    ],
    "reason": "The diagonal left trace appears to have a clear gap where it should meet the pad near the lower center, which would break electrical continuity.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.7,\"reason\":\"The diagonal left trace appears to have a clear gap where it should meet the pad near the lower center, which would break electrical continuity.\"}",
    "latency_ms": 4234.1,
    "image": "../../../eval/tasks/images/boards/00041011.jpg"
   },
   {
    "task_id": "board:00041011",
    "board_id": "00041011",
    "model": "claude-opus-5-5",
    "suite": "board",
    "trial": 2,
    "conf": 0.7,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "spur"
    ],
    "reason": "The diagonal outer trace appears to have a visible gap near x\u2248300, y\u2248410, just before it meets the horizontal pad segment, which would break electrical continuity on that conductor.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.7,\"reason\":\"The diagonal outer trace appears to have a visible gap near x\u2248300, y\u2248410, just before it meets the horizontal pad segment, which would break electrical continuity on that conductor.\"}",
    "latency_ms": 4495.0,
    "image": "../../../eval/tasks/images/boards/00041011.jpg"
   },
   {
    "task_id": "board:00041020",
    "board_id": "00041020",
    "model": "claude-opus-5-5",
    "suite": "board",
    "trial": 0,
    "conf": 0.7,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "mousebite",
     "spur"
    ],
    "reason": "A thin white gap appears to cut fully across the narrow diagonal trace in the lower right near the pad, which would break electrical continuity; smaller edge nicks are also visible on the upper traces.",
    "raw": "```json\n{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.7,\"reason\":\"A thin white gap appears to cut fully across the narrow diagonal trace in the lower right near the pad, which would break electrical continuity; smaller edge nicks are also visible on the upper traces.\"}\n```",
    "latency_ms": 4116.5,
    "image": "../../../eval/tasks/images/boards/00041020.jpg"
   },
   {
    "task_id": "board:00041020",
    "board_id": "00041020",
    "model": "claude-opus-5-5",
    "suite": "board",
    "trial": 2,
    "conf": 0.7,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "mousebite",
     "spur"
    ],
    "reason": "A white gap appears to cut fully across the narrow diagonal trace in the lower right (around x\u2248530, y\u2248470), which would break electrical continuity; the smaller nicks along the edges of the wide traces look like secondary edge damage.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.7,\"reason\":\"A white gap appears to cut fully across the narrow diagonal trace in the lower right (around x\u2248530, y\u2248470), which would break electrical continuity; the smaller nicks along the edges of the wide traces look like secondary edge damage.\"}",
    "latency_ms": 4345.0,
    "image": "../../../eval/tasks/images/boards/00041020.jpg"
   }
  ],
  "claude-sonnet-5-5": [
   {
    "task_id": "board:00041012:clean",
    "board_id": "00041012",
    "model": "claude-sonnet-5-5",
    "suite": "board",
    "trial": 0,
    "conf": 0.8,
    "said_type": "spur",
    "said_disp": "rework",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "A thin trace on the left edge has a short perpendicular copper protrusion branching off it, which is a spur that needs to be trimmed.",
    "raw": "{\"defect_type\":\"spur\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.8,\"reason\":\"A thin trace on the left edge has a short perpendicular copper protrusion branching off it, which is a spur that needs to be trimmed.\"}",
    "latency_ms": 2057.0,
    "image": "../../../eval/tasks/images/boards/00041012_clean.jpg"
   },
   {
    "task_id": "board:00041012:clean",
    "board_id": "00041012",
    "model": "claude-sonnet-5-5",
    "suite": "board",
    "trial": 1,
    "conf": 0.8,
    "said_type": "spur",
    "said_disp": "rework",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "A thin trace on the left edge has a short perpendicular copper protrusion extending sideways from it, which is characteristic of a spur.",
    "raw": "{\"defect_type\":\"spur\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.8,\"reason\":\"A thin trace on the left edge has a short perpendicular copper protrusion extending sideways from it, which is characteristic of a spur.\"}",
    "latency_ms": 1753.8,
    "image": "../../../eval/tasks/images/boards/00041012_clean.jpg"
   },
   {
    "task_id": "board:00041012:clean",
    "board_id": "00041012",
    "model": "claude-sonnet-5-5",
    "suite": "board",
    "trial": 2,
    "conf": 0.8,
    "said_type": "spur",
    "said_disp": "rework",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "A thin trace on the left edge has a short perpendicular copper protrusion branching off it, which is a spur that needs to be trimmed.",
    "raw": "{\"defect_type\":\"spur\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.8,\"reason\":\"A thin trace on the left edge has a short perpendicular copper protrusion branching off it, which is a spur that needs to be trimmed.\"}",
    "latency_ms": 1839.9,
    "image": "../../../eval/tasks/images/boards/00041012_clean.jpg"
   },
   {
    "task_id": "board:00041017:clean",
    "board_id": "00041017",
    "model": "claude-sonnet-5-5",
    "suite": "board",
    "trial": 1,
    "conf": 0.8,
    "said_type": "none",
    "said_disp": "pass",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "All traces and pads appear continuous with clean edges and round holes, and I see no opens, shorts, mousebites, spurs, copper residue or pinholes.",
    "raw": "{\"defect_type\":\"none\",\"severity\":\"cosmetic\",\"disposition\":\"pass\",\"confidence\":0.8,\"reason\":\"All traces and pads appear continuous with clean edges and round holes, and I see no opens, shorts, mousebites, spurs, copper residue or pinholes.\"}",
    "latency_ms": 3477.2,
    "image": "../../../eval/tasks/images/boards/00041017_clean.jpg"
   },
   {
    "task_id": "board:00041017:clean",
    "board_id": "00041017",
    "model": "claude-sonnet-5-5",
    "suite": "board",
    "trial": 2,
    "conf": 0.8,
    "said_type": "none",
    "said_disp": "pass",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "All traces and pads are continuous with smooth edges, and I see no breaks, bridges, nicks, spurs, stray copper or extra pinholes; the only holes are the intended pad holes.",
    "raw": "{\"defect_type\":\"none\",\"severity\":\"cosmetic\",\"disposition\":\"pass\",\"confidence\":0.8,\"reason\":\"All traces and pads are continuous with smooth edges, and I see no breaks, bridges, nicks, spurs, stray copper or extra pinholes; the only holes are the intended pad holes.\"}",
    "latency_ms": 3313.7,
    "image": "../../../eval/tasks/images/boards/00041017_clean.jpg"
   },
   {
    "task_id": "board:00041020:clean",
    "board_id": "00041020",
    "model": "claude-sonnet-5-5",
    "suite": "board",
    "trial": 1,
    "conf": 0.8,
    "said_type": "none",
    "said_disp": "pass",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "Traces and pads are continuous with clean edges, and the white circles are regular drilled holes centered in their pads, with no opens, shorts, mousebites, spurs, excess copper or pinholes.",
    "raw": "{\"defect_type\":\"none\",\"severity\":\"cosmetic\",\"disposition\":\"pass\",\"confidence\":0.8,\"reason\":\"Traces and pads are continuous with clean edges, and the white circles are regular drilled holes centered in their pads, with no opens, shorts, mousebites, spurs, excess copper or pinholes.\"}",
    "latency_ms": 3606.2,
    "image": "../../../eval/tasks/images/boards/00041020_clean.jpg"
   },
   {
    "task_id": "board:00041017",
    "board_id": "00041017",
    "model": "claude-sonnet-5-5",
    "suite": "board",
    "trial": 1,
    "conf": 0.72,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "The diagonal trace in the upper right is interrupted by a thin white gap near y\u2248130, which breaks continuity between the top pad and the lower pad.",
    "raw": "The image is a binarized close-up with black traces on a white background. In the upper right, a trace running diagonally from the top-right pad toward the lower pad is interrupted. A thin white band crosses the trace at about y=130, so the copper looks broken or nearly broken there. That points to an open circuit.\n\nThe small specks elsewhere look like noise or minor artifacts.\n\n```json\n{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.72,\"reason\":\"The diagonal trace in the upper right is interrupted by a thin white gap near y\u2248130, which breaks continuity between the top pad and the lower pad.\"}\n```",
    "latency_ms": 2761.9,
    "image": "../../../eval/tasks/images/boards/00041017.jpg"
   },
   {
    "task_id": "board:00041002:clean",
    "board_id": "00041002",
    "model": "claude-sonnet-5-5",
    "suite": "board",
    "trial": 0,
    "conf": 0.72,
    "said_type": "none",
    "said_disp": "pass",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "The traces and the ring pad with its hole have continuous, well-defined edges, with no breaks, bridges, nicks, spurs, or pinholes visible in this view.",
    "raw": "{\"defect_type\":\"none\",\"severity\":\"cosmetic\",\"disposition\":\"pass\",\"confidence\":0.72,\"reason\":\"The traces and the ring pad with its hole have continuous, well-defined edges, with no breaks, bridges, nicks, spurs, or pinholes visible in this view.\"}",
    "latency_ms": 2998.7,
    "image": "../../../eval/tasks/images/boards/00041002_clean.jpg"
   }
  ],
  "gemini-3-1-pro": [
   {
    "task_id": "board:00041001",
    "board_id": "00041001",
    "model": "gemini-3-1-pro",
    "suite": "board",
    "trial": 0,
    "conf": 0.95,
    "said_type": "pinhole",
    "said_disp": "rework",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A small pinhole defect is visible in the copper trace.",
    "raw": "{\n  \"defect_type\": \"pinhole\",\n  \"severity\": \"minor\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"A small pinhole defect is visible in the copper trace.\"\n}",
    "latency_ms": 3978.6,
    "image": "../../../eval/tasks/images/boards/00041001.jpg"
   },
   {
    "task_id": "board:00041000",
    "board_id": "00041000",
    "model": "gemini-3-1-pro",
    "suite": "board",
    "trial": 1,
    "conf": 0.95,
    "said_type": "short",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A thin trace of copper is creating an unintended connection (short) between two separate traces.",
    "raw": "{\n  \"defect_type\": \"short\",\n  \"severity\": \"critical\",\n  \"disposition\": \"scrap\",\n  \"confidence\": 0.95,\n  \"reason\": \"A thin trace of copper is creating an unintended connection (short) between two separate traces.\"\n}",
    "latency_ms": 4032.8,
    "image": "../../../eval/tasks/images/boards/00041000.jpg"
   },
   {
    "task_id": "board:00041000",
    "board_id": "00041000",
    "model": "gemini-3-1-pro",
    "suite": "board",
    "trial": 0,
    "conf": 0.95,
    "said_type": "short",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A thin copper trace is creating an unintended connection (short) between two separate traces.",
    "raw": "{\n  \"defect_type\": \"short\",\n  \"severity\": \"critical\",\n  \"disposition\": \"scrap\",\n  \"confidence\": 0.95,\n  \"reason\": \"A thin copper trace is creating an unintended connection (short) between two separate traces.\"\n}",
    "latency_ms": 4082.2,
    "image": "../../../eval/tasks/images/boards/00041000.jpg"
   },
   {
    "task_id": "board:00041000",
    "board_id": "00041000",
    "model": "gemini-3-1-pro",
    "suite": "board",
    "trial": 2,
    "conf": 0.95,
    "said_type": "short",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A thin trace of copper is creating an unintended connection (short) between two separate traces.",
    "raw": "{\n  \"defect_type\": \"short\",\n  \"severity\": \"critical\",\n  \"disposition\": \"scrap\",\n  \"confidence\": 0.95,\n  \"reason\": \"A thin trace of copper is creating an unintended connection (short) between two separate traces.\"\n}",
    "latency_ms": 4116.3,
    "image": "../../../eval/tasks/images/boards/00041000.jpg"
   },
   {
    "task_id": "board:00041001",
    "board_id": "00041001",
    "model": "gemini-3-1-pro",
    "suite": "board",
    "trial": 1,
    "conf": 0.95,
    "said_type": "pinhole",
    "said_disp": "rework",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A small pinhole defect is visible in the trace, requiring rework to ensure proper conductivity.",
    "raw": "{\n  \"defect_type\": \"pinhole\",\n  \"severity\": \"minor\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"A small pinhole defect is visible in the trace, requiring rework to ensure proper conductivity.\"\n}",
    "latency_ms": 2431.6,
    "image": "../../../eval/tasks/images/boards/00041001.jpg"
   },
   {
    "task_id": "board:00041002",
    "board_id": "00041002",
    "model": "gemini-3-1-pro",
    "suite": "board",
    "trial": 0,
    "conf": 0.95,
    "said_type": "copper",
    "said_disp": "rework",
    "truth_disp": "scrap",
    "truth_worst": "short",
    "truth_types": [
     "short",
     "copper",
     "pinhole",
     "spur"
    ],
    "reason": "There are stray copper spots visible in the clearance area between traces.",
    "raw": "{\n  \"defect_type\": \"copper\",\n  \"severity\": \"minor\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"There are stray copper spots visible in the clearance area between traces.\"\n}",
    "latency_ms": 3897.1,
    "image": "../../../eval/tasks/images/boards/00041002.jpg"
   },
   {
    "task_id": "board:00041002",
    "board_id": "00041002",
    "model": "gemini-3-1-pro",
    "suite": "board",
    "trial": 1,
    "conf": 0.95,
    "said_type": "copper",
    "said_disp": "rework",
    "truth_disp": "scrap",
    "truth_worst": "short",
    "truth_types": [
     "short",
     "copper",
     "pinhole",
     "spur"
    ],
    "reason": "There are stray copper spots visible in the clearance areas.",
    "raw": "{\n  \"defect_type\": \"copper\",\n  \"severity\": \"minor\",\n  \"disposition\": \"rework\",\n  \"confidence\": 0.95,\n  \"reason\": \"There are stray copper spots visible in the clearance areas.\"\n}",
    "latency_ms": 4171.1,
    "image": "../../../eval/tasks/images/boards/00041002.jpg"
   },
   {
    "task_id": "board:00041003",
    "board_id": "00041003",
    "model": "gemini-3-1-pro",
    "suite": "board",
    "trial": 0,
    "conf": 0.95,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole"
    ],
    "reason": "There is a complete break in the copper trace, creating an open circuit.",
    "raw": "{\n  \"defect_type\": \"open\",\n  \"severity\": \"critical\",\n  \"disposition\": \"scrap\",\n  \"confidence\": 0.95,\n  \"reason\": \"There is a complete break in the copper trace, creating an open circuit.\"\n}",
    "latency_ms": 2848.3,
    "image": "../../../eval/tasks/images/boards/00041003.jpg"
   }
  ],
  "gpt-5-5": [
   {
    "task_id": "board:00041021",
    "board_id": "00041021",
    "model": "gpt-5-5",
    "suite": "board",
    "trial": 0,
    "conf": 0.93,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "The bottom horizontal conductor has a clear break/gap, indicating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.93,\"reason\":\"The bottom horizontal conductor has a clear break/gap, indicating an open circuit.\"}",
    "latency_ms": 3622.7,
    "image": "../../../eval/tasks/images/boards/00041021.jpg"
   },
   {
    "task_id": "board:00041021",
    "board_id": "00041021",
    "model": "gpt-5-5",
    "suite": "board",
    "trial": 2,
    "conf": 0.93,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "The bottom horizontal copper trace is visibly broken by a clear gap, indicating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.93,\"reason\":\"The bottom horizontal copper trace is visibly broken by a clear gap, indicating an open circuit.\"}",
    "latency_ms": 3193.7,
    "image": "../../../eval/tasks/images/boards/00041021.jpg"
   },
   {
    "task_id": "board:00041010",
    "board_id": "00041010",
    "model": "gpt-5-5",
    "suite": "board",
    "trial": 1,
    "conf": 0.92,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A vertical copper trace near the lower-left center has a clear gap separating the conductor, indicating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.92,\"reason\":\"A vertical copper trace near the lower-left center has a clear gap separating the conductor, indicating an open circuit.\"}",
    "latency_ms": 4952.1,
    "image": "../../../eval/tasks/images/boards/00041010.jpg"
   },
   {
    "task_id": "board:00041010",
    "board_id": "00041010",
    "model": "gpt-5-5",
    "suite": "board",
    "trial": 2,
    "conf": 0.92,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A vertical copper trace near the lower-left area is visibly broken by a white gap, indicating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.92,\"reason\":\"A vertical copper trace near the lower-left area is visibly broken by a white gap, indicating an open circuit.\"}",
    "latency_ms": 4652.8,
    "image": "../../../eval/tasks/images/boards/00041010.jpg"
   },
   {
    "task_id": "board:00041015",
    "board_id": "00041015",
    "model": "gpt-5-5",
    "suite": "board",
    "trial": 2,
    "conf": 0.92,
    "said_type": "copper",
    "said_disp": "rework",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole"
    ],
    "reason": "An isolated black copper speck is visible in the lower-left area away from the intended traces.",
    "raw": "{\"defect_type\":\"copper\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.92,\"reason\":\"An isolated black copper speck is visible in the lower-left area away from the intended traces.\"}",
    "latency_ms": 5836.8,
    "image": "../../../eval/tasks/images/boards/00041015.jpg"
   },
   {
    "task_id": "board:00041018",
    "board_id": "00041018",
    "model": "gpt-5-5",
    "suite": "board",
    "trial": 0,
    "conf": 0.92,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A horizontal copper trace is visibly broken by a clear gap, creating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.92,\"reason\":\"A horizontal copper trace is visibly broken by a clear gap, creating an open circuit.\"}",
    "latency_ms": 3295.0,
    "image": "../../../eval/tasks/images/boards/00041018.jpg"
   },
   {
    "task_id": "board:00041021",
    "board_id": "00041021",
    "model": "gpt-5-5",
    "suite": "board",
    "trial": 1,
    "conf": 0.92,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "The long horizontal conductor near the bottom has a clear break/gap, indicating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.92,\"reason\":\"The long horizontal conductor near the bottom has a clear break/gap, indicating an open circuit.\"}",
    "latency_ms": 5995.2,
    "image": "../../../eval/tasks/images/boards/00041021.jpg"
   },
   {
    "task_id": "board:00041025",
    "board_id": "00041025",
    "model": "gpt-5-5",
    "suite": "board",
    "trial": 1,
    "conf": 0.92,
    "said_type": "short",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A visible copper bridge connects two adjacent horizontal traces, creating an electrical short.",
    "raw": "{\"defect_type\":\"short\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.92,\"reason\":\"A visible copper bridge connects two adjacent horizontal traces, creating an electrical short.\"}",
    "latency_ms": 3385.5,
    "image": "../../../eval/tasks/images/boards/00041025.jpg"
   }
  ],
  "gpt-5-mini": [
   {
    "task_id": "board:00041015:clean",
    "board_id": "00041015",
    "model": "gpt-5-mini",
    "suite": "board",
    "trial": 2,
    "conf": 0.92,
    "said_type": "none",
    "said_disp": "pass",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "Traces appear continuous with no visible breaks, shorts, spurs, or holes in the inspected area; only minor edge roughness visible.",
    "raw": "{\"defect_type\":\"none\",\"severity\":\"cosmetic\",\"disposition\":\"pass\",\"confidence\":0.92,\"reason\":\"Traces appear continuous with no visible breaks, shorts, spurs, or holes in the inspected area; only minor edge roughness visible.\"}",
    "latency_ms": 2033.2,
    "image": "../../../eval/tasks/images/boards/00041015_clean.jpg"
   },
   {
    "task_id": "board:00041025:clean",
    "board_id": "00041025",
    "model": "gpt-5-mini",
    "suite": "board",
    "trial": 2,
    "conf": 0.89,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "There is a clear gap in the middle trace indicating an open circuit where copper is missing, which will interrupt connectivity and requires scrapping.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"major\",\"disposition\":\"scrap\",\"confidence\":0.89,\"reason\":\"There is a clear gap in the middle trace indicating an open circuit where copper is missing, which will interrupt connectivity and requires scrapping.\"}",
    "latency_ms": 1451.7,
    "image": "../../../eval/tasks/images/boards/00041025_clean.jpg"
   },
   {
    "task_id": "board:00041001",
    "board_id": "00041001",
    "model": "gpt-5-mini",
    "suite": "board",
    "trial": 0,
    "conf": 0.88,
    "said_type": "pinhole",
    "said_disp": "rework",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "Small void/hole in the copper trace is visible near the upper left of the thick trace and appears localized and not severing the trace.",
    "raw": "{\"defect_type\":\"pinhole\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.88,\"reason\":\"Small void/hole in the copper trace is visible near the upper left of the thick trace and appears localized and not severing the trace.\"}",
    "latency_ms": 2585.4,
    "image": "../../../eval/tasks/images/boards/00041001.jpg"
   },
   {
    "task_id": "board:00041002",
    "board_id": "00041002",
    "model": "gpt-5-mini",
    "suite": "board",
    "trial": 0,
    "conf": 0.88,
    "said_type": "pinhole",
    "said_disp": "rework",
    "truth_disp": "scrap",
    "truth_worst": "short",
    "truth_types": [
     "short",
     "copper",
     "pinhole",
     "spur"
    ],
    "reason": "Small isolated void-like black spots on the copper area consistent with pinhole defects that are not large enough to break traces but require rework.",
    "raw": "{\"defect_type\":\"pinhole\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.88,\"reason\":\"Small isolated void-like black spots on the copper area consistent with pinhole defects that are not large enough to break traces but require rework.\"}",
    "latency_ms": 1931.4,
    "image": "../../../eval/tasks/images/boards/00041002.jpg"
   },
   {
    "task_id": "board:00041011",
    "board_id": "00041011",
    "model": "gpt-5-mini",
    "suite": "board",
    "trial": 1,
    "conf": 0.88,
    "said_type": "spur",
    "said_disp": "rework",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "spur"
    ],
    "reason": "There is a small unwanted copper protrusion (spur) from the main trace that could cause unintended connectivity and should be removed by rework.",
    "raw": "{\"defect_type\":\"spur\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.88,\"reason\":\"There is a small unwanted copper protrusion (spur) from the main trace that could cause unintended connectivity and should be removed by rework.\"}",
    "latency_ms": 1872.1,
    "image": "../../../eval/tasks/images/boards/00041011.jpg"
   },
   {
    "task_id": "board:00041020",
    "board_id": "00041020",
    "model": "gpt-5-mini",
    "suite": "board",
    "trial": 0,
    "conf": 0.88,
    "said_type": "mousebite",
    "said_disp": "rework",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "mousebite",
     "spur"
    ],
    "reason": "Small notches along the copper edge consistent with mousebites; they do not sever traces but require rework to restore edge integrity.",
    "raw": "{\"defect_type\":\"mousebite\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.88,\"reason\":\"Small notches along the copper edge consistent with mousebites; they do not sever traces but require rework to restore edge integrity.\"}",
    "latency_ms": 1734.5,
    "image": "../../../eval/tasks/images/boards/00041020.jpg"
   },
   {
    "task_id": "board:00041027",
    "board_id": "00041027",
    "model": "gpt-5-mini",
    "suite": "board",
    "trial": 0,
    "conf": 0.88,
    "said_type": "spur",
    "said_disp": "rework",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "There are small thin copper whiskers/spurs jutting from the inner edges of some traces that could cause leakage; they are minor and repairable.",
    "raw": "{\"defect_type\":\"spur\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.88,\"reason\":\"There are small thin copper whiskers/spurs jutting from the inner edges of some traces that could cause leakage; they are minor and repairable.\"}",
    "latency_ms": 1900.4,
    "image": "../../../eval/tasks/images/boards/00041027.jpg"
   },
   {
    "task_id": "board:00041015:clean",
    "board_id": "00041015",
    "model": "gpt-5-mini",
    "suite": "board",
    "trial": 1,
    "conf": 0.88,
    "said_type": "none",
    "said_disp": "pass",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "Traces appear continuous with no visible breaks, shorts, spurs, mousebites, copper voids, or pinholes in the imaged area.",
    "raw": "{\"defect_type\":\"none\",\"severity\":\"cosmetic\",\"disposition\":\"pass\",\"confidence\":0.88,\"reason\":\"Traces appear continuous with no visible breaks, shorts, spurs, mousebites, copper voids, or pinholes in the imaged area.\"}",
    "latency_ms": 2053.2,
    "image": "../../../eval/tasks/images/boards/00041015_clean.jpg"
   }
  ],
  "grok-4-7": [
   {
    "task_id": "board:00041008:clean",
    "board_id": "00041008",
    "model": "grok-4-7",
    "suite": "board",
    "trial": 1,
    "conf": 0.98,
    "said_type": "none",
    "said_disp": "pass",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "No defect is visible in the shown copper trace or surrounding board area.",
    "raw": "{\"defect_type\":\"none\",\"severity\":\"cosmetic\",\"disposition\":\"pass\",\"confidence\":0.98,\"reason\":\"No defect is visible in the shown copper trace or surrounding board area.\"}",
    "latency_ms": 35090.1,
    "image": "../../../eval/tasks/images/boards/00041008_clean.jpg"
   },
   {
    "task_id": "board:00041003",
    "board_id": "00041003",
    "model": "grok-4-7",
    "suite": "board",
    "trial": 2,
    "conf": 0.95,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole"
    ],
    "reason": "A visible break in the copper trace near the lower pad interrupts the conductor, creating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.95,\"reason\":\"A visible break in the copper trace near the lower pad interrupts the conductor, creating an open circuit.\"}",
    "latency_ms": 3401.5,
    "image": "../../../eval/tasks/images/boards/00041003.jpg"
   },
   {
    "task_id": "board:00041018",
    "board_id": "00041018",
    "model": "grok-4-7",
    "suite": "board",
    "trial": 0,
    "conf": 0.95,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A thin horizontal trace is visibly broken by a gap, interrupting continuity.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.95,\"reason\":\"A thin horizontal trace is visibly broken by a gap, interrupting continuity.\"}",
    "latency_ms": 44814.8,
    "image": "../../../eval/tasks/images/boards/00041018.jpg"
   },
   {
    "task_id": "board:00041017",
    "board_id": "00041017",
    "model": "grok-4-7",
    "suite": "board",
    "trial": 2,
    "conf": 0.93,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "The upper-right trace is visibly broken, creating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.93,\"reason\":\"The upper-right trace is visibly broken, creating an open circuit.\"}",
    "latency_ms": 86662.3,
    "image": "../../../eval/tasks/images/boards/00041017.jpg"
   },
   {
    "task_id": "board:00041025:clean",
    "board_id": "00041025",
    "model": "grok-4-7",
    "suite": "board",
    "trial": 1,
    "conf": 0.93,
    "said_type": "none",
    "said_disp": "pass",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "Continuous copper traces show clean edges, uniform width, and proper spacing with no visible defect.",
    "raw": "{\"defect_type\":\"none\",\"severity\":\"cosmetic\",\"disposition\":\"pass\",\"confidence\":0.93,\"reason\":\"Continuous copper traces show clean edges, uniform width, and proper spacing with no visible defect.\"}",
    "latency_ms": 45416.5,
    "image": "../../../eval/tasks/images/boards/00041025_clean.jpg"
   },
   {
    "task_id": "board:00041028",
    "board_id": "00041028",
    "model": "grok-4-7",
    "suite": "board",
    "trial": 1,
    "conf": 0.93,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A horizontal trace near the center is visibly interrupted, creating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.93,\"reason\":\"A horizontal trace near the center is visibly interrupted, creating an open circuit.\"}",
    "latency_ms": 49378.1,
    "image": "../../../eval/tasks/images/boards/00041028.jpg"
   },
   {
    "task_id": "board:00041028:clean",
    "board_id": "00041028",
    "model": "grok-4-7",
    "suite": "board",
    "trial": 0,
    "conf": 0.92,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "A horizontal trace is visibly broken before its pad, leaving an open gap in the conductor.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.92,\"reason\":\"A horizontal trace is visibly broken before its pad, leaving an open gap in the conductor.\"}",
    "latency_ms": 68529.7,
    "image": "../../../eval/tasks/images/boards/00041028_clean.jpg"
   },
   {
    "task_id": "board:00041000:clean",
    "board_id": "00041000",
    "model": "grok-4-7",
    "suite": "board",
    "trial": 0,
    "conf": 0.9,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "A clear gap separates the central trace from the pad structure, creating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.9,\"reason\":\"A clear gap separates the central trace from the pad structure, creating an open circuit.\"}",
    "latency_ms": 10514.9,
    "image": "../../../eval/tasks/images/boards/00041000_clean.jpg"
   }
  ],
  "kimi-k3-1-pro": [
   {
    "task_id": "board:00041008",
    "board_id": "00041008",
    "model": "kimi-k3-1-pro",
    "suite": "board",
    "trial": 2,
    "conf": 0.97,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole"
    ],
    "reason": "A visible gap completely interrupts the diagonal copper trace, creating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.97,\"reason\":\"A visible gap completely interrupts the diagonal copper trace, creating an open circuit.\"}",
    "latency_ms": 4640.8,
    "image": "../../../eval/tasks/images/boards/00041008.jpg"
   },
   {
    "task_id": "board:00041018",
    "board_id": "00041018",
    "model": "kimi-k3-1-pro",
    "suite": "board",
    "trial": 1,
    "conf": 0.97,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "The thin horizontal trace has a distinct gap that completely interrupts electrical continuity.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.97,\"reason\":\"The thin horizontal trace has a distinct gap that completely interrupts electrical continuity.\"}",
    "latency_ms": 4595.6,
    "image": "../../../eval/tasks/images/boards/00041018.jpg"
   },
   {
    "task_id": "board:00041018",
    "board_id": "00041018",
    "model": "kimi-k3-1-pro",
    "suite": "board",
    "trial": 0,
    "conf": 0.97,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A clear gap completely interrupts the thin horizontal trace, creating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.97,\"reason\":\"A clear gap completely interrupts the thin horizontal trace, creating an open circuit.\"}",
    "latency_ms": 30020.1,
    "image": "../../../eval/tasks/images/boards/00041018.jpg"
   },
   {
    "task_id": "board:00041004",
    "board_id": "00041004",
    "model": "kimi-k3-1-pro",
    "suite": "board",
    "trial": 2,
    "conf": 0.96,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A visible gap interrupts the narrow trace at the lower right, creating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.96,\"reason\":\"A visible gap interrupts the narrow trace at the lower right, creating an open circuit.\"}",
    "latency_ms": 8668.2,
    "image": "../../../eval/tasks/images/boards/00041004.jpg"
   },
   {
    "task_id": "board:00041008",
    "board_id": "00041008",
    "model": "kimi-k3-1-pro",
    "suite": "board",
    "trial": 1,
    "conf": 0.96,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole"
    ],
    "reason": "The diagonal copper trace has a complete transverse gap, interrupting electrical continuity.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.96,\"reason\":\"The diagonal copper trace has a complete transverse gap, interrupting electrical continuity.\"}",
    "latency_ms": 4898.3,
    "image": "../../../eval/tasks/images/boards/00041008.jpg"
   },
   {
    "task_id": "board:00041008",
    "board_id": "00041008",
    "model": "kimi-k3-1-pro",
    "suite": "board",
    "trial": 0,
    "conf": 0.96,
    "said_type": "open",
    "said_disp": "scrap",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole"
    ],
    "reason": "A visible gap completely interrupts the diagonal copper trace, creating an open circuit.",
    "raw": "{\"defect_type\":\"open\",\"severity\":\"critical\",\"disposition\":\"scrap\",\"confidence\":0.96,\"reason\":\"A visible gap completely interrupts the diagonal copper trace, creating an open circuit.\"}",
    "latency_ms": 14600.4,
    "image": "../../../eval/tasks/images/boards/00041008.jpg"
   },
   {
    "task_id": "board:00041013",
    "board_id": "00041013",
    "model": "kimi-k3-1-pro",
    "suite": "board",
    "trial": 0,
    "conf": 0.96,
    "said_type": "pinhole",
    "said_disp": "rework",
    "truth_disp": "scrap",
    "truth_worst": "open",
    "truth_types": [
     "open",
     "short",
     "copper",
     "mousebite",
     "pinhole",
     "spur"
    ],
    "reason": "A small isolated void is visible in the lower copper pad, indicating a pinhole without severing the conductor.",
    "raw": "{\"defect_type\":\"pinhole\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.96,\"reason\":\"A small isolated void is visible in the lower copper pad, indicating a pinhole without severing the conductor.\"}",
    "latency_ms": 7011.9,
    "image": "../../../eval/tasks/images/boards/00041013.jpg"
   },
   {
    "task_id": "board:00041014:clean",
    "board_id": "00041014",
    "model": "kimi-k3-1-pro",
    "suite": "board",
    "trial": 1,
    "conf": 0.96,
    "said_type": "spur",
    "said_disp": "rework",
    "truth_disp": "pass",
    "truth_worst": "none",
    "truth_types": [
     "none"
    ],
    "reason": "A localized copper protrusion extends from the left vertical trace without bridging to an adjacent conductor, consistent with a spur.",
    "raw": "{\"defect_type\":\"spur\",\"severity\":\"minor\",\"disposition\":\"rework\",\"confidence\":0.96,\"reason\":\"A localized copper protrusion extends from the left vertical trace without bridging to an adjacent conductor, consistent with a spur.\"}",
    "latency_ms": 7269.0,
    "image": "../../../eval/tasks/images/boards/00041014_clean.jpg"
   }
  ]
 }
};
