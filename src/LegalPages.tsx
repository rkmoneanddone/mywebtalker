import type {ReactNode} from "react";
export type InfoPage="terms"|"privacy"|"contact";
const email="moneybasicswithrohit@gmail.com";
export const relatedSites=[
 {label:"NashtaBuddy",url:"https://nashtabuddy.in/"},
 {label:"Lucky Dangle",url:"https://luckydangle-app.web.app/"},
 {label:"ParentsBoard",url:"https://parentsboard.in/"},
 {label:"QuickStories",url:"https://quickstories.in/"}
];
function Section({title,children}:{title:string;children:ReactNode}){return <section style={{margin:"22px 0"}}><h2>{title}</h2><p>{children}</p></section>}
export default function LegalPages({page}:{page:InfoPage}){
 return <article className="container" style={{maxWidth:850,padding:"50px 20px 90px",lineHeight:1.8}}>
 {page==="terms"?<><h1>Terms & Conditions</h1><p>Last updated: October 2026. These terms apply to the MyWebTalker website and chatbot service.</p>
 <Section title="Service">MyWebTalker lets account holders configure website chatbots, import supported knowledge and collect visitor enquiries. Account holders must have permission to use the websites and content they submit.</Section>
 <Section title="Accounts and acceptable use">Keep your account secure. Do not upload unlawful content, personal secrets, malware or material you do not have rights to use. Do not abuse the service or attempt to bypass usage limits or security controls.</Section>
 <Section title="Plans and trial">Plans have website, knowledge and response limits as displayed at signup. A seven-day trial may be available. Paid checkout is unavailable until a payment gateway is activated. Published prices and plan limits may be updated prospectively; any payment will be shown and confirmed before purchase.</Section>
 <Section title="AI responses">Automated answers can be incomplete or inaccurate. Account holders should verify important information and keep their knowledge sources current. Do not rely on chatbot answers for medical, legal, financial or emergency decisions.</Section>
 <Section title="Availability and changes">We may maintain, modify or suspend features to address reliability, misuse or security. Contact support for account and service concerns.</Section>
 <Section title="Contact">For questions about these terms, email <a href={"mailto:"+email}>{email}</a>.</Section></>:
 page==="privacy"?<><h1>Privacy Policy</h1><p>Last updated: October 2026.</p>
 <Section title="Information collected">Account holders sign in through Google/Firebase authentication. We process account identifiers, configured websites, uploaded knowledge text, usage information and service settings. Chatbot visitors provide a name, email address and mobile number before starting a chat.</Section>
 <Section title="How information is used">Information is used to operate the chatbot, verify website ownership, answer questions from configured knowledge, capture visitor enquiries, apply quotas, prevent abuse and support accounts.</Section>
 <Section title="Service providers">The service uses Firebase/Google infrastructure and may send relevant knowledge excerpts and visitor questions to an AI provider when a direct answer is unavailable. Do not include sensitive personal data in chatbot questions or uploaded knowledge.</Section>
 <Section title="Storage and retention">Visitor leads are stored under the relevant website account. Limited security and usage records may be retained for operational purposes. Chat history is not a product feature in this release. Retention periods and deletion procedures should be confirmed before public launch.</Section>
 <Section title="Your choices">Website operators should provide their own visitor-facing privacy notice and appropriate disclosures. To request access, correction or deletion of your information, contact <a href={"mailto:"+email}>{email}</a>.</Section></>:
 <><h1>Contact MyWebTalker</h1><p>For account assistance, setup questions, support and privacy requests:</p><p><a href={"mailto:"+email}>{email}</a></p><h2>Other websites</h2><ul>{relatedSites.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul></>}
 </article>;
}
