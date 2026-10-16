export interface IconDefinition {
  id: string;
  name: string;
  category: "aws" | "gcp" | "azure" | "database" | "devops" | "languages" | "architecture";
  color: string;
  badgeBg: string;
  svgPath: string; // SVG inner path / elements
  viewBox?: string;
}

export const ICONS: IconDefinition[] = [
  // --- Architecture Primitives ---
  {
    id: "arch-client",
    name: "User / Client",
    category: "architecture",
    color: "#3B82F6",
    badgeBg: "rgba(59, 130, 246, 0.15)",
    svgPath: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "arch-mobile",
    name: "Mobile App",
    category: "architecture",
    color: "#8B5CF6",
    badgeBg: "rgba(139, 92, 246, 0.15)",
    svgPath: `<rect x="5" y="2" width="14" height="20" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "arch-browser",
    name: "Web Browser",
    category: "architecture",
    color: "#06B6D4",
    badgeBg: "rgba(6, 182, 212, 0.15)",
    svgPath: `<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "arch-server",
    name: "Server / Host",
    category: "architecture",
    color: "#10B981",
    badgeBg: "rgba(16, 185, 129, 0.15)",
    svgPath: `<rect x="2" y="2" width="20" height="8" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="6" y1="6" x2="6.01" y2="6" stroke="currentColor" stroke-width="2"/><line x1="6" y1="18" x2="6.01" y2="18" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "arch-lb",
    name: "Load Balancer",
    category: "architecture",
    color: "#F59E0B",
    badgeBg: "rgba(245, 158, 11, 0.15)",
    svgPath: `<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="8" cy="18" r="2" fill="currentColor"/>`,
  },
  {
    id: "arch-gateway",
    name: "API Gateway",
    category: "architecture",
    color: "#EC4899",
    badgeBg: "rgba(236, 72, 153, 0.15)",
    svgPath: `<polygon points="12 2 2 7 12 12 22 7 12 2" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="2 17 12 22 22 17" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="2 12 12 17 22 12" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "arch-queue",
    name: "Message Queue",
    category: "architecture",
    color: "#6366F1",
    badgeBg: "rgba(99, 102, 241, 0.15)",
    svgPath: `<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="7" y1="9" x2="7.01" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="9" x2="12.01" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="17" y1="9" x2="17.01" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 15h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "arch-microservice",
    name: "Microservice",
    category: "architecture",
    color: "#14B8A6",
    badgeBg: "rgba(20, 184, 166, 0.15)",
    svgPath: `<rect x="4" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "arch-cloud",
    name: "Cloud Network",
    category: "architecture",
    color: "#0EA5E9",
    badgeBg: "rgba(14, 165, 233, 0.15)",
    svgPath: `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: "arch-security",
    name: "Firewall / Auth",
    category: "architecture",
    color: "#EF4444",
    badgeBg: "rgba(239, 68, 68, 0.15)",
    svgPath: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  // --- AWS Cloud ---
  {
    id: "aws-lambda",
    name: "AWS Lambda",
    category: "aws",
    color: "#FF9900",
    badgeBg: "rgba(255, 153, 0, 0.15)",
    svgPath: `<path d="M6 18L10 6h4l4 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "aws-s3",
    name: "AWS S3 Bucket",
    category: "aws",
    color: "#E05243",
    badgeBg: "rgba(224, 82, 67, 0.15)",
    svgPath: `<path d="M4 7c0-2 4-4 8-4s8 2 8 4-4 4-8 4-8-2-8-4z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 7v6c0 2 4 4 8 4s8-2 8-4V7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 13v4c0 2 4 4 8 4s8-2 8-4v-4" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "aws-ec2",
    name: "AWS EC2",
    category: "aws",
    color: "#FF9900",
    badgeBg: "rgba(255, 153, 0, 0.15)",
    svgPath: `<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 9h6v6H9z" fill="currentColor"/><line x1="9" y1="1" x2="9" y2="4" stroke="currentColor" stroke-width="2"/><line x1="15" y1="1" x2="15" y2="4" stroke="currentColor" stroke-width="2"/><line x1="9" y1="20" x2="9" y2="23" stroke="currentColor" stroke-width="2"/><line x1="15" y1="20" x2="15" y2="23" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "aws-dynamo",
    name: "AWS DynamoDB",
    category: "aws",
    color: "#3B48CC",
    badgeBg: "rgba(59, 72, 204, 0.15)",
    svgPath: `<ellipse cx="12" cy="6" rx="8" ry="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9v6" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "aws-rds",
    name: "AWS RDS",
    category: "aws",
    color: "#3B48CC",
    badgeBg: "rgba(59, 72, 204, 0.15)",
    svgPath: `<ellipse cx="12" cy="5" rx="8" ry="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "aws-apigateway",
    name: "AWS API Gateway",
    category: "aws",
    color: "#E7157B",
    badgeBg: "rgba(231, 21, 123, 0.15)",
    svgPath: `<path d="M12 3l9 5v8l-9 5-9-5V8l9-5z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8l4 2.5v4.5l-4 2.5-4-2.5V10.5l4-2.5z" fill="currentColor"/>`,
  },
  {
    id: "aws-cloudfront",
    name: "AWS CloudFront",
    category: "aws",
    color: "#A020F0",
    badgeBg: "rgba(160, 32, 240, 0.15)",
    svgPath: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "aws-ecs",
    name: "AWS ECS / EKS",
    category: "aws",
    color: "#FF9900",
    badgeBg: "rgba(255, 153, 0, 0.15)",
    svgPath: `<path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="12 2 12 11 20 6.5" stroke="currentColor" stroke-width="2"/><polyline points="12 11 4 6.5" stroke="currentColor" stroke-width="2"/><polyline points="12 11 12 20" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "aws-sqs",
    name: "AWS SQS",
    category: "aws",
    color: "#CC2264",
    badgeBg: "rgba(204, 34, 100, 0.15)",
    svgPath: `<rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12h8M13 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  // --- GCP Cloud ---
  {
    id: "gcp-functions",
    name: "GCP Cloud Run / Functions",
    category: "gcp",
    color: "#4285F4",
    badgeBg: "rgba(66, 133, 244, 0.15)",
    svgPath: `<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
  },
  {
    id: "gcp-gke",
    name: "GCP GKE (Kubernetes)",
    category: "gcp",
    color: "#34A853",
    badgeBg: "rgba(52, 168, 83, 0.15)",
    svgPath: `<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "gcp-storage",
    name: "GCP Cloud Storage",
    category: "gcp",
    color: "#EA4335",
    badgeBg: "rgba(234, 67, 53, 0.15)",
    svgPath: `<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="7" r="1" fill="currentColor"/><circle cx="10" cy="7" r="1" fill="currentColor"/>`,
  },
  {
    id: "gcp-bigquery",
    name: "GCP BigQuery",
    category: "gcp",
    color: "#4285F4",
    badgeBg: "rgba(66, 133, 244, 0.15)",
    svgPath: `<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="8" y="9" width="6" height="4" rx="1" fill="currentColor"/>`,
  },
  {
    id: "gcp-pubsub",
    name: "GCP Pub/Sub",
    category: "gcp",
    color: "#4285F4",
    badgeBg: "rgba(66, 133, 244, 0.15)",
    svgPath: `<circle cx="6" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="2"/><line x1="8.7" y1="10.7" x2="15.3" y2="7.3" stroke="currentColor" stroke-width="2"/><line x1="8.7" y1="13.3" x2="15.3" y2="16.7" stroke="currentColor" stroke-width="2"/>`,
  },

  // --- Azure Cloud ---
  {
    id: "azure-vm",
    name: "Azure Virtual Machines",
    category: "azure",
    color: "#0078D4",
    badgeBg: "rgba(0, 120, 212, 0.15)",
    svgPath: `<rect x="3" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "azure-functions",
    name: "Azure Functions",
    category: "azure",
    color: "#0078D4",
    badgeBg: "rgba(0, 120, 212, 0.15)",
    svgPath: `<path d="M8 4l-4 8h5l-2 8 8-11h-5l3-5z" fill="currentColor"/>`,
  },
  {
    id: "azure-cosmos",
    name: "Azure Cosmos DB",
    category: "azure",
    color: "#5C2D91",
    badgeBg: "rgba(92, 45, 145, 0.15)",
    svgPath: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="12" cy="12" rx="9" ry="4" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },

  // --- Databases & Caches ---
  {
    id: "db-postgres",
    name: "PostgreSQL",
    category: "database",
    color: "#336791",
    badgeBg: "rgba(51, 103, 145, 0.15)",
    svgPath: `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" fill="currentColor"/>`,
  },
  {
    id: "db-redis",
    name: "Redis Cache",
    category: "database",
    color: "#DC382D",
    badgeBg: "rgba(220, 56, 45, 0.15)",
    svgPath: `<polygon points="12 2 2 7 12 12 22 7" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="2 12 12 17 22 12" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="2 17 12 22 22 17" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "db-mongodb",
    name: "MongoDB",
    category: "database",
    color: "#47A248",
    badgeBg: "rgba(71, 162, 72, 0.15)",
    svgPath: `<path d="M12 2C12 2 5 8 5 14c0 3.87 3.13 7 7 7s7-3.13 7-7c0-6-7-12-7-12z" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="2" x2="12" y2="21" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "db-mysql",
    name: "MySQL",
    category: "database",
    color: "#00758F",
    badgeBg: "rgba(0, 117, 143, 0.15)",
    svgPath: `<ellipse cx="12" cy="6" rx="8" ry="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 6v8c0 1.66 3.58 3 8 3s8-1.34 8-3V6" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="17" stroke="currentColor" stroke-width="2"/><path d="M8 12h8" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "db-elastic",
    name: "Elasticsearch",
    category: "database",
    color: "#005571",
    badgeBg: "rgba(0, 85, 113, 0.15)",
    svgPath: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 9h10M7 15h10M9 12h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "db-supabase",
    name: "Supabase",
    category: "database",
    color: "#3ECF8E",
    badgeBg: "rgba(62, 207, 142, 0.15)",
    svgPath: `<path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z" fill="currentColor"/>`,
  },

  // --- DevOps & Cloud Native ---
  {
    id: "devops-k8s",
    name: "Kubernetes",
    category: "devops",
    color: "#326CE5",
    badgeBg: "rgba(50, 108, 229, 0.15)",
    svgPath: `<polygon points="12 2 20.66 7 20.66 17 12 22 3.34 17 3.34 7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/>`,
  },
  {
    id: "devops-docker",
    name: "Docker",
    category: "devops",
    color: "#2496ED",
    badgeBg: "rgba(36, 150, 237, 0.15)",
    svgPath: `<rect x="2" y="11" width="20" height="7" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="5" y="7" width="3" height="3" fill="currentColor"/><rect x="9" y="7" width="3" height="3" fill="currentColor"/><rect x="13" y="7" width="3" height="3" fill="currentColor"/><rect x="9" y="3" width="3" height="3" fill="currentColor"/><circle cx="18" cy="14" r="1" fill="currentColor"/>`,
  },
  {
    id: "devops-kafka",
    name: "Apache Kafka",
    category: "devops",
    color: "#231F20",
    badgeBg: "rgba(35, 31, 32, 0.2)",
    svgPath: `<circle cx="12" cy="12" r="4" fill="currentColor"/><circle cx="5" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="19" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="5" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="19" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><line x1="7.2" y1="7.5" x2="9.5" y2="10" stroke="currentColor" stroke-width="2"/><line x1="16.8" y1="7.5" x2="14.5" y2="10" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "devops-terraform",
    name: "Terraform",
    category: "devops",
    color: "#7B42BC",
    badgeBg: "rgba(123, 66, 188, 0.15)",
    svgPath: `<polygon points="3 3 8.5 6 8.5 12 3 9" fill="currentColor"/><polygon points="9.5 6 15 9 15 15 9.5 12" fill="currentColor"/><polygon points="16 9 21.5 12 21.5 18 16 15" fill="currentColor"/><polygon points="9.5 13 15 16 15 22 9.5 19" fill="currentColor"/>`,
  },
  {
    id: "devops-github",
    name: "GitHub",
    category: "devops",
    color: "#FFFFFF",
    badgeBg: "rgba(255, 255, 255, 0.15)",
    svgPath: `<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: "devops-nginx",
    name: "Nginx",
    category: "devops",
    color: "#009639",
    badgeBg: "rgba(0, 150, 57, 0.15)",
    svgPath: `<polygon points="12 2 21 7 21 17 12 22 3 17 3 7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 16V8l8 8V8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },

  // --- Languages & Frameworks ---
  {
    id: "lang-react",
    name: "React / React Native",
    category: "languages",
    color: "#61DAFB",
    badgeBg: "rgba(97, 218, 251, 0.15)",
    svgPath: `<ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(30 12 12)" fill="none" stroke="currentColor" stroke-width="1.8"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(90 12 12)" fill="none" stroke="currentColor" stroke-width="1.8"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(150 12 12)" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>`,
  },
  {
    id: "lang-nextjs",
    name: "Next.js",
    category: "languages",
    color: "#FFFFFF",
    badgeBg: "rgba(255, 255, 255, 0.15)",
    svgPath: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 16V8l8 9.5M15 8v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "lang-node",
    name: "Node.js",
    category: "languages",
    color: "#339933",
    badgeBg: "rgba(51, 153, 51, 0.15)",
    svgPath: `<polygon points="12 2 21 7 21 17 12 22 3 17 3 7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6v12M7 9l5 3 5-3" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "lang-ts",
    name: "TypeScript",
    category: "languages",
    color: "#3178C6",
    badgeBg: "rgba(49, 120, 198, 0.15)",
    svgPath: `<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 8h6M11 8v8M15 11c1-1 3-1 3 1s-2 1-2 2 2 1 2 2-2 1-3 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: "lang-python",
    name: "Python",
    category: "languages",
    color: "#3776AB",
    badgeBg: "rgba(55, 118, 171, 0.15)",
    svgPath: `<path d="M12 2a5 5 0 0 0-5 5v2h5v1H5a5 5 0 0 0-5 5 5 5 0 0 0 5 5h2v-2a3 3 0 0 1 3-3h4a3 3 0 0 0 3-3V7a5 5 0 0 0-5-5z" fill="currentColor"/><circle cx="9" cy="5" r="1" fill="#fff"/>`,
  },
  {
    id: "lang-go",
    name: "Go (Golang)",
    category: "languages",
    color: "#00ADD8",
    badgeBg: "rgba(0, 173, 216, 0.15)",
    svgPath: `<circle cx="8" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 9h5v6h-5" fill="none" stroke="currentColor" stroke-width="2"/><line x1="17.5" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: "lang-graphql",
    name: "GraphQL",
    category: "languages",
    color: "#E10098",
    badgeBg: "rgba(225, 0, 152, 0.15)",
    svgPath: `<polygon points="12 2 20.66 7 20.66 17 12 22 3.34 17 3.34 7" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" stroke-width="1.5"/><line x1="3.34" y1="7" x2="20.66" y2="17" stroke="currentColor" stroke-width="1.5"/><line x1="3.34" y1="17" x2="20.66" y2="7" stroke="currentColor" stroke-width="1.5"/>`,
  },
];

export function getIconById(id: string): IconDefinition | undefined {
  return ICONS.find((i) => i.id === id);
}

export function searchIcons(query: string, category?: string): IconDefinition[] {
  let filtered = ICONS;
  if (category && category !== "all") {
    filtered = filtered.filter((i) => i.category === category);
  }
  if (!query || query.trim() === "") {
    return filtered;
  }
  const q = query.toLowerCase().trim();
  return filtered.filter(
    (i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
  );
}
