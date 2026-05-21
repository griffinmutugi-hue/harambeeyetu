import schoolImg from "@/assets/campaign-school.jpg";
import medicalImg from "@/assets/campaign-medical.jpg";
import communityImg from "@/assets/campaign-community.jpg";
import businessImg from "@/assets/campaign-business.jpg";

export type Category = "medical" | "education" | "community" | "other";

export type Donor = { name: string; amount: number; when: string };

export type Campaign = {
  id: string;
  title: string;
  organizer: string;
  story: string;
  category: Category;
  goal: number;
  raised: number;
  daysLeft: number;
  image: string;
  donors: Donor[];
};

const seed: Campaign[] = [
  {
    id: "shule-ya-mama-grace",
    title: "Build a classroom for Mama Grace's school",
    organizer: "Mama Grace Wanjiru",
    category: "education",
    story:
      "For 12 years I have taught 64 children under a mango tree in Kajiado. When the rains come, lessons stop. We need KES 450,000 to put up two iron-sheet classrooms so our children can learn every day — sun or rain. Every shilling will be accounted for, and we will share photos as the walls go up.",
    goal: 450000,
    raised: 287400,
    daysLeft: 18,
    image: schoolImg,
    donors: [
      { name: "Brian K.", amount: 5000, when: "2h ago" },
      { name: "Anonymous", amount: 1000, when: "4h ago" },
      { name: "Wanjiku M.", amount: 2500, when: "6h ago" },
      { name: "Otieno J.", amount: 500, when: "yesterday" },
      { name: "Cynthia A.", amount: 10000, when: "2 days ago" },
    ],
  },
  {
    id: "cucu-mwikali-surgery",
    title: "Cucu Mwikali needs hip surgery",
    organizer: "Faith Mutindi",
    category: "medical",
    story:
      "My grandmother fell three weeks ago and cannot walk. Kenyatta Hospital needs KES 180,000 for the operation and recovery. She raised 9 of us — now it's our turn to carry her. Asanteni sana for any little you can give.",
    goal: 180000,
    raised: 142300,
    daysLeft: 7,
    image: medicalImg,
    donors: [
      { name: "Mercy W.", amount: 3000, when: "1h ago" },
      { name: "Kevin O.", amount: 500, when: "3h ago" },
      { name: "Anonymous", amount: 20000, when: "5h ago" },
      { name: "Joy N.", amount: 1500, when: "yesterday" },
    ],
  },
  {
    id: "kibera-tree-project",
    title: "Plant 1,000 trees in Kibera",
    organizer: "Green Kibera Collective",
    category: "community",
    story:
      "We are 14 youth from Kibera turning empty plots into green spaces. Funds cover seedlings, tools, and water tanks for the dry season. Join us in making our home cooler and greener.",
    goal: 220000,
    raised: 58900,
    daysLeft: 31,
    image: communityImg,
    donors: [
      { name: "Lydia M.", amount: 1000, when: "5h ago" },
      { name: "Anonymous", amount: 500, when: "yesterday" },
    ],
  },
  {
    id: "mama-akinyi-mama-mboga",
    title: "Help Mama Akinyi rebuild her stall",
    organizer: "Akinyi Adhiambo",
    category: "other",
    story:
      "My mama mboga stall in Gikomba burned down last month. I need KES 75,000 to restock vegetables and rebuild the kibanda. I have fed my three children with this stall for 8 years.",
    goal: 75000,
    raised: 71200,
    daysLeft: 3,
    image: businessImg,
    donors: [
      { name: "Peter G.", amount: 2000, when: "30m ago" },
      { name: "Anonymous", amount: 1000, when: "2h ago" },
      { name: "Sharon W.", amount: 500, when: "4h ago" },
    ],
  },
];

// Simple in-memory + localStorage store for created campaigns
const STORAGE_KEY = "harambee:campaigns";

function loadCreated(): Campaign[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Campaign[]) : [];
  } catch {
    return [];
  }
}

function saveCreated(list: Campaign[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getAllCampaigns(): Campaign[] {
  return [...loadCreated(), ...seed];
}

export function getCampaign(id: string): Campaign | undefined {
  return getAllCampaigns().find((c) => c.id === id);
}

export function addCampaign(input: {
  title: string;
  organizer: string;
  story: string;
  category: Category;
  goal: number;
  image: string;
}): Campaign {
  const id =
    input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) +
    "-" +
    Math.random().toString(36).slice(2, 6);
  const c: Campaign = {
    id,
    title: input.title,
    organizer: input.organizer || "Anonymous Organizer",
    story: input.story,
    category: input.category,
    goal: input.goal,
    raised: 0,
    daysLeft: 30,
    image: input.image,
    donors: [],
  };
  const list = loadCreated();
  list.unshift(c);
  saveCreated(list);
  return c;
}

export function addDonation(id: string, name: string, amount: number) {
  const list = loadCreated();
  const idx = list.findIndex((c) => c.id === id);
  if (idx >= 0) {
    list[idx].raised += amount;
    list[idx].donors.unshift({ name: name || "Anonymous", amount, when: "just now" });
    saveCreated(list);
    return;
  }
  // donate to seed campaign — mutate in-memory copy
  const s = seed.find((c) => c.id === id);
  if (s) {
    s.raised += amount;
    s.donors.unshift({ name: name || "Anonymous", amount, when: "just now" });
  }
}

export const categoryLabel: Record<Category, string> = {
  medical: "Medical",
  education: "Education",
  community: "Community",
  other: "Other",
};

export function formatKES(n: number) {
  return "KES " + n.toLocaleString("en-KE");
}
