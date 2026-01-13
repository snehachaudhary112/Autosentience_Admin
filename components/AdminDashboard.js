import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

// Initialize Supabase client
const supabaseUrl = "https://dbzfjoonimkbrsajtkwf.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiemZqb29uaW1rYnJzYWp0a3dmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg2MTM5NCwiZXhwIjoyMDgwNDM3Mzk0fQ.h49v9LU_RCDgUREVkjL7lX4XqB0abCW6ytiZLM43zmw";
const supabase = createClient(supabaseUrl, supabaseKey);

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [bookings, setBookings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sensorReadings, setSensorReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState("");

  // Fetch dashboard statistics
  const fetchStats = async () => {
    try {
      const today = startOfDay(new Date());
      const thirtyDaysAgo = subDays(today, 30);

      const [bookingsCount, alertsCount, pendingBookings, criticalAlerts] =
        await Promise.all([
          supabase.from("bookings").select("id", { count: "exact" }),
          supabase.from("alerts").select("id", { count: "exact" }),
          supabase
            .from("bookings")
            .select("id", { count: "exact" })
            .eq("status", "PENDING"),
          supabase
            .from("alerts")
            .select("id", { count: "exact" })
            .eq("severity", "CRITICAL"),
        ]);

      const recentBookings = await supabase
        .from("bookings")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString());

      setStats({
        totalBookings: bookingsCount.count || 0,
        totalAlerts: alertsCount.count || 0,
        pendingBookings: pendingBookings.count || 0,
        criticalAlerts: criticalAlerts.count || 0,
        recentBookings: recentBookings.data?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  // Fetch bookings
  const fetchBookings = async () => {
    try {
      let query = supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching bookings:", error);
      } else {
        setBookings(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Fetch alerts
  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching alerts:", error);
      } else {
        setAlerts(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Fetch sensor readings
  const fetchSensorReadings = async () => {
    try {
      const { data, error } = await supabase
        .from("sensor_readings")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching sensor readings:", error);
      } else {
        setSensorReadings(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // Update booking status
  const updateBookingStatus = async (bookingId, newStatus) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", bookingId);

      if (error) {
        showNotification("Failed to update booking status", "error");
      } else {
        showNotification(`Booking status updated to ${newStatus}`, "success");
        fetchBookings();
        fetchStats();
      }
    } catch (error) {
      console.error("Error:", error);
      showNotification("An error occurred", "error");
    }
  };

  // Update alert status
  const updateAlertStatus = async (alertId, newStatus) => {
    try {
      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "ACKNOWLEDGED") {
        updateData.acknowledged_at = new Date().toISOString();
      } else if (newStatus === "RESOLVED") {
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("alerts")
        .update(updateData)
        .eq("id", alertId);

      if (error) {
        showNotification("Failed to update alert status", "error");
      } else {
        showNotification(`Alert status updated to ${newStatus}`, "success");
        fetchAlerts();
        fetchStats();
      }
    } catch (error) {
      console.error("Error:", error);
      showNotification("An error occurred", "error");
    }
  };

  // Show notification
  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(""), 3000);
  };

  // View details
  const viewDetails = (item, type) => {
    setSelectedItem({ ...item, type });
    setShowModal(true);
  };

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchBookings(),
        fetchAlerts(),
        fetchSensorReadings(),
      ]);
      setLoading(false);
    };

    initializeData();
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    const bookingsSubscription = supabase
      .channel("bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          fetchBookings();
          fetchStats();
        }
      )
      .subscribe();

    const alertsSubscription = supabase
      .channel("alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => {
          fetchAlerts();
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsSubscription);
      supabase.removeChannel(alertsSubscription);
    };
  }, []);

  // Status badge component
  const StatusBadge = ({ status, type = "booking" }) => {
    const getStatusStyle = (status) => {
      if (type === "booking") {
        switch (status) {
          case "PENDING":
            return {
              background: "linear-gradient(to right, #facc15, #ca8a04)",
            };
          case "CONFIRMED":
            return {
              background: "linear-gradient(to right, #60a5fa, #2563eb)",
            };
          case "IN_SERVICE":
            return {
              background: "linear-gradient(to right, #c084fc, #9333ea)",
            };
          case "COMPLETED":
            return {
              background: "linear-gradient(to right, #4ade80, #16a34a)",
            };
          case "CANCELLED":
            return {
              background: "linear-gradient(to right, #f87171, #dc2626)",
            };
          default:
            return {
              background: "linear-gradient(to right, #9ca3af, #6b7280)",
            };
        }
      } else {
        switch (status) {
          case "OPEN":
            return {
              background: "linear-gradient(to right, #f87171, #dc2626)",
            };
          case "ACKNOWLEDGED":
            return {
              background: "linear-gradient(to right, #facc15, #ca8a04)",
            };
          case "IN_PROGRESS":
            return {
              background: "linear-gradient(to right, #60a5fa, #2563eb)",
            };
          case "RESOLVED":
            return {
              background: "linear-gradient(to right, #4ade80, #16a34a)",
            };
          case "CLOSED":
            return {
              background: "linear-gradient(to right, #9ca3af, #6b7280)",
            };
          default:
            return {
              background: "linear-gradient(to right, #9ca3af, #6b7280)",
            };
        }
      }
    };

    return (
      <span
        style={{
          padding: "4px 12px",
          borderRadius: "9999px",
          fontSize: "12px",
          fontWeight: "600",
          color: "white",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
          ...getStatusStyle(status),
        }}
      >
        {status}
      </span>
    );
  };

  // Severity badge component
  const SeverityBadge = ({ severity }) => {
    const getSeverityStyle = (severity) => {
      switch (severity) {
        case "LOW":
          return { background: "linear-gradient(to right, #4ade80, #16a34a)" };
        case "MEDIUM":
          return { background: "linear-gradient(to right, #facc15, #ca8a04)" };
        case "HIGH":
          return { background: "linear-gradient(to right, #fb923c, #ea580c)" };
        case "CRITICAL":
          return { background: "linear-gradient(to right, #f87171, #dc2626)" };
        default:
          return { background: "linear-gradient(to right, #9ca3af, #6b7280)" };
      }
    };

    return (
      <span
        style={{
          padding: "4px 12px",
          borderRadius: "9999px",
          fontSize: "12px",
          fontWeight: "600",
          color: "white",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
          ...getSeverityStyle(severity),
        }}
      >
        {severity}
      </span>
    );
  };

  // Sidebar navigation
  const Sidebar = () => (
    <div
      style={{
        width: "288px",
        background: "linear-gradient(to bottom, #111827, #1f2937)",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        borderRight: "1px solid #374151",
        zIndex: 10,
      }}
    >
      <div style={{ padding: "32px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              background: "linear-gradient(to right, #3b82f6, #9333ea)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              style={{ width: "24px", height: "24px", color: "white" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "white",
              margin: 0,
            }}
          >
            Admin Panel
          </h1>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            {
              id: "dashboard",
              label: "Dashboard",
              icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
            },
            {
              id: "bookings",
              label: "Bookings",
              icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
            },
            {
              id: "alerts",
              label: "Alerts",
              icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
            },
            {
              id: "sensors",
              label: "Sensor Data",
              icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
            },
            {
              id: "voice",
              label: "Voice Logs",
              icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z",
            },
            {
              id: "security",
              label: "Security",
              icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
            },
          ].map((item) => (
            <button
              key={item.id}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px 20px",
                borderRadius: "12px",
                transition: "all 0.2s ease",
                border: "none",
                cursor: "pointer",
                background:
                  activeTab === item.id
                    ? "linear-gradient(to right, #3b82f6, #9333ea)"
                    : "transparent",
                color: activeTab === item.id ? "white" : "#9ca3af",
                boxShadow:
                  activeTab === item.id
                    ? "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                    : "none",
                transform: activeTab === item.id ? "scale(1.05)" : "scale(1)",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== item.id) {
                  e.target.style.background = "#374151";
                  e.target.style.color = "white";
                  e.target.style.boxShadow =
                    "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== item.id) {
                  e.target.style.background = "transparent";
                  e.target.style.color = "#9ca3af";
                  e.target.style.boxShadow = "none";
                }
              }}
              onClick={() => setActiveTab(item.id)}
            >
              <svg
                style={{ width: "20px", height: "20px" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={item.icon}
                />
              </svg>
              <span style={{ fontWeight: "500" }}>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );

  // Dashboard content
  const DashboardContent = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "24px",
        }}
      >
        {[
          {
            label: "Total Bookings",
            value: stats.totalBookings || 0,
            color: "linear-gradient(to right, #3b82f6, #1d4ed8)",
            icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
          },
          {
            label: "Pending Bookings",
            value: stats.pendingBookings || 0,
            color: "linear-gradient(to right, #facc15, #ca8a04)",
            icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
          },
          {
            label: "Total Alerts",
            value: stats.totalAlerts || 0,
            color: "linear-gradient(to right, #fb923c, #ea580c)",
            icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
          },
          {
            label: "Critical Alerts",
            value: stats.criticalAlerts || 0,
            color: "linear-gradient(to right, #f87171, #dc2626)",
            icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
          },
        ].map((stat, index) => (
          <div key={index} style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: "-2px",
                left: "-2px",
                right: "-2px",
                bottom: "-2px",
                background: stat.color,
                opacity: 0.75,
                borderRadius: "16px",
                transition: "opacity 0.3s ease",
              }}
            />
            <div
              style={{
                position: "relative",
                background: "#1f2937",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                transition: "all 0.3s ease, transform 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow =
                  "0 25px 50px -12px rgba(0, 0, 0, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 25px 50px -12px rgba(0, 0, 0, 0.25)";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <p
                    style={{
                      color: "#9ca3af",
                      fontSize: "14px",
                      fontWeight: "500",
                      marginBottom: "8px",
                    }}
                  >
                    {stat.label}
                  </p>
                  <p
                    style={{
                      fontSize: "36px",
                      fontWeight: "bold",
                      color: "white",
                      margin: 0,
                    }}
                  >
                    {stat.value}
                  </p>
                </div>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    background: stat.color,
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  <svg
                    style={{ width: "28px", height: "28px", color: "white" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={stat.icon}
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Bookings and Alerts */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: "32px",
        }}
      >
        <div
          style={{
            background: "#1f2937",
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "linear-gradient(to right, #3b82f6, #9333ea)",
              padding: "24px",
            }}
          >
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: "white",
                margin: 0,
              }}
            >
              Recent Bookings
            </h3>
          </div>
          <div
            style={{ padding: "24px", maxHeight: "384px", overflowY: "auto" }}
          >
            {bookings.length === 0 ? (
              <p
                style={{
                  color: "#9ca3af",
                  textAlign: "center",
                  padding: "32px 0",
                }}
              >
                No bookings found
              </p>
            ) : (
              bookings.slice(0, 5).map((booking) => (
                <div
                  key={booking.id}
                  style={{
                    background: "rgba(55, 65, 81, 0.5)",
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "16px",
                    border: "1px solid #4b5563",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#374151";
                    e.currentTarget.style.borderColor = "#3b82f6";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(55, 65, 81, 0.5)";
                    e.currentTarget.style.borderColor = "#4b5563";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          color: "white",
                          fontWeight: "600",
                          fontSize: "18px",
                        }}
                      >
                        {booking.service_type}
                      </p>
                      <p
                        style={{
                          color: "#d1d5db",
                          fontSize: "14px",
                          marginTop: "4px",
                        }}
                      >
                        {booking.customer_name}
                      </p>
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "12px",
                          marginTop: "8px",
                        }}
                      >
                        {format(
                          new Date(booking.created_at),
                          "MMM dd, yyyy hh:mm a"
                        )}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          style={{
            background: "#1f2937",
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "linear-gradient(to right, #fb923c, #dc2626)",
              padding: "24px",
            }}
          >
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: "white",
                margin: 0,
              }}
            >
              Recent Alerts
            </h3>
          </div>
          <div
            style={{ padding: "24px", maxHeight: "384px", overflowY: "auto" }}
          >
            {alerts.length === 0 ? (
              <p
                style={{
                  color: "#9ca3af",
                  textAlign: "center",
                  padding: "32px 0",
                }}
              >
                No alerts found
              </p>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    background: "rgba(55, 65, 81, 0.5)",
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "16px",
                    border: "1px solid #4b5563",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#374151";
                    e.currentTarget.style.borderColor = "#fb923c";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(55, 65, 81, 0.5)";
                    e.currentTarget.style.borderColor = "#4b5563";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          color: "white",
                          fontWeight: "600",
                          fontSize: "18px",
                        }}
                      >
                        {alert.title}
                      </p>
                      <p
                        style={{
                          color: "#d1d5db",
                          fontSize: "14px",
                          marginTop: "4px",
                        }}
                      >
                        {alert.vehicle_id}
                      </p>
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "12px",
                          marginTop: "8px",
                        }}
                      >
                        {format(
                          new Date(alert.created_at),
                          "MMM dd, yyyy hh:mm a"
                        )}
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <SeverityBadge severity={alert.severity} />
                      <StatusBadge status={alert.status} type="alert" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Bookings content
  const BookingsContent = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div
        style={{
          background: "#1f2937",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "linear-gradient(to right, #3b82f6, #9333ea)",
            padding: "32px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: "white",
                margin: 0,
              }}
            >
              Service Bookings
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ position: "relative" }}>
                <svg
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "20px",
                    height: "20px",
                    color: "#9ca3af",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search bookings..."
                  style={{
                    paddingLeft: "40px",
                    paddingRight: "16px",
                    padding: "12px",
                    background: "rgba(55, 65, 81, 0.5)",
                    borderRadius: "12px",
                    color: "white",
                    border: "1px solid #4b5563",
                    width: "256px",
                    fontSize: "14px",
                  }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                style={{
                  padding: "12px 16px",
                  background: "rgba(55, 65, 81, 0.5)",
                  borderRadius: "12px",
                  color: "white",
                  border: "1px solid #4b5563",
                  fontSize: "14px",
                }}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="IN_SERVICE">In Service</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <button
                style={{
                  padding: "12px 24px",
                  background: "linear-gradient(to right, #3b82f6, #9333ea)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "white",
                  fontWeight: "500",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "linear-gradient(to right, #2563eb, #7c3aed)";
                  e.currentTarget.style.boxShadow =
                    "0 25px 50px -12px rgba(0, 0, 0, 0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "linear-gradient(to right, #3b82f6, #9333ea)";
                  e.currentTarget.style.boxShadow =
                    "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
                }}
                onClick={() => {
                  fetchBookings();
                  showNotification("Bookings refreshed", "success");
                }}
              >
                <svg
                  style={{ width: "16px", height: "16px" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "rgba(55, 65, 81, 0.5)",
                  borderBottom: "1px solid #4b5563",
                }}
              >
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  ID
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Customer
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Service
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Vehicle
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Scheduled
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {bookings
                .filter((booking) => {
                  if (!searchTerm) return true;
                  const term = searchTerm.toLowerCase();
                  return (
                    booking.customer_name?.toLowerCase().includes(term) ||
                    booking.customer_email?.toLowerCase().includes(term) ||
                    booking.service_type?.toLowerCase().includes(term) ||
                    booking.vehicle_id?.toLowerCase().includes(term)
                  );
                })
                .map((booking) => (
                  <tr
                    key={booking.id}
                    style={{
                      borderBottom: "1px solid #374151",
                      transition: "background 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(55, 65, 81, 0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={{ padding: "16px 24px" }}>
                      <span
                        style={{
                          color: "#9ca3af",
                          fontFamily: "monospace",
                          fontSize: "14px",
                          background: "rgba(55, 65, 81, 0.5)",
                          padding: "4px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        #{booking.id?.substring(0, 8)}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <div>
                        <p style={{ color: "white", fontWeight: "500" }}>
                          {booking.customer_name || "N/A"}
                        </p>
                        <p style={{ color: "#9ca3af", fontSize: "14px" }}>
                          {booking.customer_email || "N/A"}
                        </p>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "16px 24px",
                        color: "white",
                        fontWeight: "500",
                      }}
                    >
                      {booking.service_type || "N/A"}
                    </td>
                    <td style={{ padding: "16px 24px", color: "white" }}>
                      {booking.vehicle_id || "N/A"}
                    </td>
                    <td style={{ padding: "16px 24px", color: "white" }}>
                      {booking.scheduled_date && (
                        <div>
                          <p>
                            {format(
                              new Date(booking.scheduled_date),
                              "MMM dd, yyyy"
                            )}
                          </p>
                          <p style={{ color: "#9ca3af", fontSize: "14px" }}>
                            {booking.scheduled_time || "N/A"}
                          </p>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <StatusBadge status={booking.status} />
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          style={{
                            padding: "8px",
                            background: "rgba(55, 65, 81, 0.5)",
                            borderRadius: "8px",
                            border: "none",
                            cursor: "pointer",
                            transition: "background 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#4b5563";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background =
                              "rgba(55, 65, 81, 0.5)";
                          }}
                          onClick={() => viewDetails(booking, "booking")}
                        >
                          <svg
                            style={{
                              width: "16px",
                              height: "16px",
                              color: "white",
                            }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </button>
                        {booking.status === "PENDING" && (
                          <button
                            style={{
                              padding: "4px 12px",
                              background:
                                "linear-gradient(to right, #4ade80, #16a34a)",
                              borderRadius: "8px",
                              fontSize: "14px",
                              color: "white",
                              fontWeight: "500",
                              border: "none",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                "linear-gradient(to right, #16a34a, #15803d)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background =
                                "linear-gradient(to right, #4ade80, #16a34a)";
                            }}
                            onClick={() =>
                              updateBookingStatus(booking.id, "CONFIRMED")
                            }
                          >
                            Confirm
                          </button>
                        )}
                        {booking.status === "CONFIRMED" && (
                          <button
                            style={{
                              padding: "4px 12px",
                              background:
                                "linear-gradient(to right, #c084fc, #9333ea)",
                              borderRadius: "8px",
                              fontSize: "14px",
                              color: "white",
                              fontWeight: "500",
                              border: "none",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                "linear-gradient(to right, #9333ea, #7c3aed)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background =
                                "linear-gradient(to right, #c084fc, #9333ea)";
                            }}
                            onClick={() =>
                              updateBookingStatus(booking.id, "IN_SERVICE")
                            }
                          >
                            Start
                          </button>
                        )}
                        {booking.status === "IN_SERVICE" && (
                          <button
                            style={{
                              padding: "4px 12px",
                              background:
                                "linear-gradient(to right, #4ade80, #16a34a)",
                              borderRadius: "8px",
                              fontSize: "14px",
                              color: "white",
                              fontWeight: "500",
                              border: "none",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                "linear-gradient(to right, #16a34a, #15803d)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background =
                                "linear-gradient(to right, #4ade80, #16a34a)";
                            }}
                            onClick={() =>
                              updateBookingStatus(booking.id, "COMPLETED")
                            }
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Alerts content
  const AlertsContent = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div
        style={{
          background: "#1f2937",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "linear-gradient(to right, #fb923c, #dc2626)",
            padding: "32px",
          }}
        >
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "white",
              margin: 0,
            }}
          >
            System Alerts
          </h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "rgba(55, 65, 81, 0.5)",
                  borderBottom: "1px solid #4b5563",
                }}
              >
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  ID
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Vehicle
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Title
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Severity
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Created
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr
                  key={alert.id}
                  style={{
                    borderBottom: "1px solid #374151",
                    transition: "background 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(55, 65, 81, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <td style={{ padding: "16px 24px" }}>
                    <span
                      style={{
                        color: "#9ca3af",
                        fontFamily: "monospace",
                        fontSize: "14px",
                        background: "rgba(55, 65, 81, 0.5)",
                        padding: "4px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      #{alert.id?.substring(0, 8)}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "16px 24px",
                      color: "white",
                      fontWeight: "500",
                    }}
                  >
                    {alert.vehicle_id || "N/A"}
                  </td>
                  <td style={{ padding: "16px 24px", color: "white" }}>
                    {alert.title}
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <SeverityBadge severity={alert.severity} />
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <StatusBadge status={alert.status} type="alert" />
                  </td>
                  <td style={{ padding: "16px 24px", color: "white" }}>
                    {format(new Date(alert.created_at), "MMM dd, yyyy hh:mm a")}
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        style={{
                          padding: "8px",
                          background: "rgba(55, 65, 81, 0.5)",
                          borderRadius: "8px",
                          border: "none",
                          cursor: "pointer",
                          transition: "background 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#4b5563";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            "rgba(55, 65, 81, 0.5)";
                        }}
                        onClick={() => viewDetails(alert, "alert")}
                      >
                        <svg
                          style={{
                            width: "16px",
                            height: "16px",
                            color: "white",
                          }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </button>
                      {alert.status === "OPEN" && (
                        <button
                          style={{
                            padding: "4px 12px",
                            background:
                              "linear-gradient(to right, #facc15, #ca8a04)",
                            borderRadius: "8px",
                            fontSize: "14px",
                            color: "white",
                            fontWeight: "500",
                            border: "none",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background =
                              "linear-gradient(to right, #ca8a04, #a16207)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background =
                              "linear-gradient(to right, #facc15, #ca8a04)";
                          }}
                          onClick={() =>
                            updateAlertStatus(alert.id, "ACKNOWLEDGED")
                          }
                        >
                          Acknowledge
                        </button>
                      )}
                      {alert.status === "ACKNOWLEDGED" && (
                        <button
                          style={{
                            padding: "4px 12px",
                            background:
                              "linear-gradient(to right, #60a5fa, #2563eb)",
                            borderRadius: "8px",
                            fontSize: "14px",
                            color: "white",
                            fontWeight: "500",
                            border: "none",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background =
                              "linear-gradient(to right, #2563eb, #1d4ed8)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background =
                              "linear-gradient(to right, #60a5fa, #2563eb)";
                          }}
                          onClick={() =>
                            updateAlertStatus(alert.id, "IN_PROGRESS")
                          }
                        >
                          In Progress
                        </button>
                      )}
                      {(alert.status === "IN_PROGRESS" ||
                        alert.status === "ACKNOWLEDGED") && (
                        <button
                          style={{
                            padding: "4px 12px",
                            background:
                              "linear-gradient(to right, #4ade80, #16a34a)",
                            borderRadius: "8px",
                            fontSize: "14px",
                            color: "white",
                            fontWeight: "500",
                            border: "none",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background =
                              "linear-gradient(to right, #16a34a, #15803d)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background =
                              "linear-gradient(to right, #4ade80, #16a34a)";
                          }}
                          onClick={() =>
                            updateAlertStatus(alert.id, "RESOLVED")
                          }
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Sensor Data content
  const SensorDataContent = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div
        style={{
          background: "#1f2937",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "linear-gradient(to right, #14b8a6, #0891b2)",
            padding: "32px",
          }}
        >
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "white",
              margin: 0,
            }}
          >
            Latest Sensor Readings
          </h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "rgba(55, 65, 81, 0.5)",
                  borderBottom: "1px solid #4b5563",
                }}
              >
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Vehicle ID
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Timestamp
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Engine Temp
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  RPM
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Battery
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Fuel Level
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 24px",
                    color: "#d1d5db",
                    fontWeight: "600",
                  }}
                >
                  Speed
                </th>
              </tr>
            </thead>
            <tbody>
              {sensorReadings.map((reading) => (
                <tr
                  key={reading.id}
                  style={{
                    borderBottom: "1px solid #374151",
                    transition: "background 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(55, 65, 81, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <td
                    style={{
                      padding: "16px 24px",
                      color: "white",
                      fontWeight: "500",
                    }}
                  >
                    {reading.vehicle_id}
                  </td>
                  <td style={{ padding: "16px 24px", color: "white" }}>
                    {format(
                      new Date(reading.timestamp),
                      "MMM dd, yyyy hh:mm:ss a"
                    )}
                  </td>
                  <td style={{ padding: "16px 24px", color: "white" }}>
                    {reading.engine_temp || "N/A"}°C
                  </td>
                  <td style={{ padding: "16px 24px", color: "white" }}>
                    {reading.engine_rpm || "N/A"}
                  </td>
                  <td style={{ padding: "16px 24px", color: "white" }}>
                    {reading.battery_voltage || "N/A"}V
                  </td>
                  <td style={{ padding: "16px 24px", color: "white" }}>
                    {reading.fuel_level || "N/A"}%
                  </td>
                  <td style={{ padding: "16px 24px", color: "white" }}>
                    {reading.speed || "N/A"} km/h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Detail Modal
  const DetailModal = () => {
    if (!showModal || !selectedItem) return null;

    const isBooking = selectedItem.type === "booking";
    const item = selectedItem;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          zIndex: 50,
        }}
      >
        <div
          style={{
            background: "#1f2937",
            borderRadius: "16px",
            maxWidth: "768px",
            width: "100%",
            maxHeight: "90vh",
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div
            style={{
              background: isBooking
                ? "linear-gradient(to right, #3b82f6, #9333ea)"
                : "linear-gradient(to right, #fb923c, #dc2626)",
              padding: "24px 32px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "white",
                  margin: 0,
                }}
              >
                {isBooking ? "Booking Details" : "Alert Details"}
              </h2>
              <button
                style={{
                  color: "rgba(255, 255, 255, 0.8)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)";
                }}
                onClick={() => setShowModal(false)}
              >
                <svg
                  style={{ width: "24px", height: "24px" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div
            style={{
              padding: "32px",
              overflowY: "auto",
              maxHeight: "calc(90vh - 100px)",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
              {isBooking ? (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "24px",
                    }}
                  >
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Booking ID
                      </p>
                      <p
                        style={{
                          color: "white",
                          fontFamily: "monospace",
                          fontSize: "18px",
                        }}
                      >
                        #{item.id?.substring(0, 8)}
                      </p>
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Status
                      </p>
                      <StatusBadge status={item.status} />
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Customer Name
                      </p>
                      <p style={{ color: "white", fontSize: "18px" }}>
                        {item.customer_name || "N/A"}
                      </p>
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Email
                      </p>
                      <p style={{ color: "white", fontSize: "18px" }}>
                        {item.customer_email || "N/A"}
                      </p>
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Phone
                      </p>
                      <p style={{ color: "white", fontSize: "18px" }}>
                        {item.customer_phone || "N/A"}
                      </p>
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Vehicle ID
                      </p>
                      <p style={{ color: "white", fontSize: "18px" }}>
                        {item.vehicle_id || "N/A"}
                      </p>
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Service Type
                      </p>
                      <p style={{ color: "white", fontSize: "18px" }}>
                        {item.service_type || "N/A"}
                      </p>
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Service Center
                      </p>
                      <p style={{ color: "white", fontSize: "18px" }}>
                        {item.service_center || "N/A"}
                      </p>
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Scheduled Date
                      </p>
                      <p style={{ color: "white", fontSize: "18px" }}>
                        {item.scheduled_date || "N/A"}
                      </p>
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Scheduled Time
                      </p>
                      <p style={{ color: "white", fontSize: "18px" }}>
                        {item.scheduled_time || "N/A"}
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      background: "rgba(55, 65, 81, 0.3)",
                      borderRadius: "12px",
                      padding: "24px",
                      border: "1px solid #4b5563",
                    }}
                  >
                    <p
                      style={{
                        color: "#9ca3af",
                        fontSize: "14px",
                        fontWeight: "500",
                        marginBottom: "12px",
                      }}
                    >
                      Issue Description
                    </p>
                    <div
                      style={{
                        background: "rgba(31, 41, 55, 0.5)",
                        padding: "16px",
                        borderRadius: "8px",
                        color: "white",
                      }}
                    >
                      {item.issue_description || "No description provided"}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "rgba(55, 65, 81, 0.3)",
                      borderRadius: "12px",
                      padding: "24px",
                      border: "1px solid #4b5563",
                    }}
                  >
                    <p
                      style={{
                        color: "#9ca3af",
                        fontSize: "14px",
                        fontWeight: "500",
                        marginBottom: "12px",
                      }}
                    >
                      Special Instructions
                    </p>
                    <div
                      style={{
                        background: "rgba(31, 41, 55, 0.5)",
                        padding: "16px",
                        borderRadius: "8px",
                        color: "white",
                      }}
                    >
                      {item.special_instructions || "No special instructions"}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "24px",
                    }}
                  >
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Alert ID
                      </p>
                      <p
                        style={{
                          color: "white",
                          fontFamily: "monospace",
                          fontSize: "18px",
                        }}
                      >
                        #{item.id?.substring(0, 8)}
                      </p>
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Status
                      </p>
                      <StatusBadge status={item.status} type="alert" />
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Vehicle ID
                      </p>
                      <p style={{ color: "white", fontSize: "18px" }}>
                        {item.vehicle_id || "N/A"}
                      </p>
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Alert Type
                      </p>
                      <p style={{ color: "white", fontSize: "18px" }}>
                        {item.alert_type || "N/A"}
                      </p>
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Severity
                      </p>
                      <SeverityBadge severity={item.severity} />
                    </div>
                    <div
                      style={{
                        background: "rgba(55, 65, 81, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #4b5563",
                      }}
                    >
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: "14px",
                          fontWeight: "500",
                          marginBottom: "8px",
                        }}
                      >
                        Created
                      </p>
                      <p style={{ color: "white", fontSize: "18px" }}>
                        {format(
                          new Date(item.created_at),
                          "MMM dd, yyyy hh:mm a"
                        )}
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      background: "rgba(55, 65, 81, 0.3)",
                      borderRadius: "12px",
                      padding: "24px",
                      border: "1px solid #4b5563",
                    }}
                  >
                    <p
                      style={{
                        color: "#9ca3af",
                        fontSize: "14px",
                        fontWeight: "500",
                        marginBottom: "12px",
                      }}
                    >
                      Title
                    </p>
                    <p
                      style={{
                        color: "white",
                        fontSize: "20px",
                        fontWeight: "600",
                      }}
                    >
                      {item.title}
                    </p>
                  </div>
                  <div
                    style={{
                      background: "rgba(55, 65, 81, 0.3)",
                      borderRadius: "12px",
                      padding: "24px",
                      border: "1px solid #4b5563",
                    }}
                  >
                    <p
                      style={{
                        color: "#9ca3af",
                        fontSize: "14px",
                        fontWeight: "500",
                        marginBottom: "12px",
                      }}
                    >
                      Description
                    </p>
                    <div
                      style={{
                        background: "rgba(31, 41, 55, 0.5)",
                        padding: "16px",
                        borderRadius: "8px",
                        color: "white",
                      }}
                    >
                      {item.description || "No description provided"}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "rgba(55, 65, 81, 0.3)",
                      borderRadius: "12px",
                      padding: "24px",
                      border: "1px solid #4b5563",
                    }}
                  >
                    <p
                      style={{
                        color: "#9ca3af",
                        fontSize: "14px",
                        fontWeight: "500",
                        marginBottom: "12px",
                      }}
                    >
                      AI Diagnosis
                    </p>
                    <div
                      style={{
                        background: "rgba(31, 41, 55, 0.5)",
                        padding: "16px",
                        borderRadius: "8px",
                        color: "white",
                      }}
                    >
                      {item.diagnosis || "No diagnosis available"}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "rgba(55, 65, 81, 0.3)",
                      borderRadius: "12px",
                      padding: "24px",
                      border: "1px solid #4b5563",
                    }}
                  >
                    <p
                      style={{
                        color: "#9ca3af",
                        fontSize: "14px",
                        fontWeight: "500",
                        marginBottom: "12px",
                      }}
                    >
                      Recommended Action
                    </p>
                    <div
                      style={{
                        background: "rgba(31, 41, 55, 0.5)",
                        padding: "16px",
                        borderRadius: "8px",
                        color: "white",
                      }}
                    >
                      {item.recommended_action || "No recommendation available"}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
              {isBooking && (
                <>
                  {item.status === "PENDING" && (
                    <button
                      style={{
                        padding: "12px 24px",
                        background:
                          "linear-gradient(to right, #4ade80, #16a34a)",
                        borderRadius: "12px",
                        color: "white",
                        fontWeight: "500",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(to right, #16a34a, #15803d)";
                        e.currentTarget.style.boxShadow =
                          "0 25px 50px -12px rgba(0, 0, 0, 0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(to right, #4ade80, #16a34a)";
                        e.currentTarget.style.boxShadow =
                          "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
                      }}
                      onClick={() => {
                        updateBookingStatus(item.id, "CONFIRMED");
                        setShowModal(false);
                      }}
                    >
                      Confirm Booking
                    </button>
                  )}
                  {item.status === "CONFIRMED" && (
                    <button
                      style={{
                        padding: "12px 24px",
                        background:
                          "linear-gradient(to right, #c084fc, #9333ea)",
                        borderRadius: "12px",
                        color: "white",
                        fontWeight: "500",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(to right, #9333ea, #7c3aed)";
                        e.currentTarget.style.boxShadow =
                          "0 25px 50px -12px rgba(0, 0, 0, 0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(to right, #c084fc, #9333ea)";
                        e.currentTarget.style.boxShadow =
                          "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
                      }}
                      onClick={() => {
                        updateBookingStatus(item.id, "IN_SERVICE");
                        setShowModal(false);
                      }}
                    >
                      Start Service
                    </button>
                  )}
                  {item.status === "IN_SERVICE" && (
                    <button
                      style={{
                        padding: "12px 24px",
                        background:
                          "linear-gradient(to right, #4ade80, #16a34a)",
                        borderRadius: "12px",
                        color: "white",
                        fontWeight: "500",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(to right, #16a34a, #15803d)";
                        e.currentTarget.style.boxShadow =
                          "0 25px 50px -12px rgba(0, 0, 0, 0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(to right, #4ade80, #16a34a)";
                        e.currentTarget.style.boxShadow =
                          "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
                      }}
                      onClick={() => {
                        updateBookingStatus(item.id, "COMPLETED");
                        setShowModal(false);
                      }}
                    >
                      Complete Service
                    </button>
                  )}
                </>
              )}
              {!isBooking && (
                <>
                  {item.status === "OPEN" && (
                    <button
                      style={{
                        padding: "12px 24px",
                        background:
                          "linear-gradient(to right, #facc15, #ca8a04)",
                        borderRadius: "12px",
                        color: "white",
                        fontWeight: "500",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(to right, #ca8a04, #a16207)";
                        e.currentTarget.style.boxShadow =
                          "0 25px 50px -12px rgba(0, 0, 0, 0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(to right, #facc15, #ca8a04)";
                        e.currentTarget.style.boxShadow =
                          "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
                      }}
                      onClick={() => {
                        updateAlertStatus(item.id, "ACKNOWLEDGED");
                        setShowModal(false);
                      }}
                    >
                      Acknowledge
                    </button>
                  )}
                  {item.status === "ACKNOWLEDGED" && (
                    <button
                      style={{
                        padding: "12px 24px",
                        background:
                          "linear-gradient(to right, #60a5fa, #2563eb)",
                        borderRadius: "12px",
                        color: "white",
                        fontWeight: "500",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(to right, #2563eb, #1d4ed8)";
                        e.currentTarget.style.boxShadow =
                          "0 25px 50px -12px rgba(0, 0, 0, 0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(to right, #60a5fa, #2563eb)";
                        e.currentTarget.style.boxShadow =
                          "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
                      }}
                      onClick={() => {
                        updateAlertStatus(item.id, "IN_PROGRESS");
                        setShowModal(false);
                      }}
                    >
                      Mark In Progress
                    </button>
                  )}
                  {(item.status === "IN_PROGRESS" ||
                    item.status === "ACKNOWLEDGED") && (
                    <button
                      style={{
                        padding: "12px 24px",
                        background:
                          "linear-gradient(to right, #4ade80, #16a34a)",
                        borderRadius: "12px",
                        color: "white",
                        fontWeight: "500",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(to right, #16a34a, #15803d)";
                        e.currentTarget.style.boxShadow =
                          "0 25px 50px -12px rgba(0, 0, 0, 0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(to right, #4ade80, #16a34a)";
                        e.currentTarget.style.boxShadow =
                          "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
                      }}
                      onClick={() => {
                        updateAlertStatus(item.id, "RESOLVED");
                        setShowModal(false);
                      }}
                    >
                      Resolve Alert
                    </button>
                  )}
                </>
              )}
              <button
                style={{
                  padding: "12px 24px",
                  background: "#4b5563",
                  borderRadius: "12px",
                  color: "white",
                  fontWeight: "500",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#6b7280";
                  e.currentTarget.style.boxShadow =
                    "0 25px 50px -12px rgba(0, 0, 0, 0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#4b5563";
                  e.currentTarget.style.boxShadow =
                    "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
                }}
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Notification component
  const Notification = () => {
    if (!notification) return null;

    const bgColor =
      notification.type === "error"
        ? "linear-gradient(to right, #f87171, #dc2626)"
        : notification.type === "success"
        ? "linear-gradient(to right, #4ade80, #16a34a)"
        : "linear-gradient(to right, #60a5fa, #2563eb)";

    return (
      <div
        style={{
          position: "fixed",
          top: "24px",
          right: "24px",
          background: bgColor,
          color: "white",
          padding: "16px 24px",
          borderRadius: "12px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          zIndex: 50,
          animation: "pulse 2s infinite",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <svg
            style={{ width: "20px", height: "20px" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span style={{ fontWeight: "500" }}>{notification.message}</span>
        </div>
      </div>
    );
  };

  // Loading screen
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(to bottom right, #111827, #1f2937)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: "80px",
                height: "80px",
                border: "4px solid #374151",
                borderRadius: "50%",
              }}
            />
            <div
              style={{
                width: "80px",
                height: "80px",
                border: "4px solid #3b82f6",
                borderRadius: "50%",
                borderTop: "4px solid transparent",
                position: "absolute",
                top: 0,
                animation: "spin 1s linear infinite",
              }}
            />
          </div>
          <p
            style={{
              color: "white",
              fontSize: "20px",
              marginTop: "24px",
              fontWeight: "500",
            }}
          >
            Loading Admin Dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, #111827, #1f2937)",
        display: "flex",
      }}
    >
      <Sidebar />
      <div style={{ flex: 1, marginLeft: "288px" }}>
        <div style={{ padding: "32px" }}>
          {activeTab === "dashboard" && <DashboardContent />}
          {activeTab === "bookings" && <BookingsContent />}
          {activeTab === "alerts" && <AlertsContent />}
          {activeTab === "sensors" && <SensorDataContent />}
          {activeTab === "voice" && (
            <div
              style={{
                background: "#1f2937",
                borderRadius: "16px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                padding: "32px",
              }}
            >
              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "white",
                  marginBottom: "16px",
                }}
              >
                Voice Logs
              </h2>
              <p style={{ color: "#9ca3af" }}>
                Voice logs feature coming soon...
              </p>
            </div>
          )}
          {activeTab === "security" && (
            <div
              style={{
                background: "#1f2937",
                borderRadius: "16px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                padding: "32px",
              }}
            >
              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "white",
                  marginBottom: "16px",
                }}
              >
                Security Logs
              </h2>
              <p style={{ color: "#9ca3af" }}>
                Security logs feature coming soon...
              </p>
            </div>
          )}
        </div>
      </div>
      <DetailModal />
      <Notification />
      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
