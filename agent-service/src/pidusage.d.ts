declare module "pidusage" {
  interface PidUsage {
    cpu: number;
    memory: number;
    ppid: number;
    pid: number;
    elapsed: number;
    timestamp: number;
  }

  interface PidUsageOptions {
    maxage?: number;
  }

  function pidusage(
    pid: number | number[],
    options?: PidUsageOptions
  ): Promise<Record<number, PidUsage>>;

  export = pidusage;
}